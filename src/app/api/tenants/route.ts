import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  unauthorized,
  handleApiError,
  safeParseBody,
  badRequest,
} from "@/lib/api-response";
import { requireApiAccess } from "@/lib/api-auth";
import { jwtVerify } from "jose";
import { getJwtSecretKey } from "@/lib/jwt";
import { onboardInstituteSchema } from "@/lib/schemas";
import { getClassTemplateDefinitions, generateTenantSlug, type TemplateClassDef } from "@/lib/onboarding-templates";
import bcrypt from "bcryptjs";

/**
 * GET /api/tenants
 * List all tenants for System Admin
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(request, {
      allowSystemAdmin: true,
    });
    if ("response" in access) return access.response;

    const { user } = access.authContext;
    if (user.role !== "SYSTEM_ADMIN" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
      return unauthorized("Only system administrators can access this.");
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { users: true, studentProfiles: true },
        },
      },
    });

    return successResponse(tenants);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/tenants
 * Onboard & provision a new school institute
 */
export async function POST(request: NextRequest) {
  try {
    // Optional System Admin authentication verification
    const token =
      request.cookies.get("auth_token")?.value ||
      request.headers.get("authorization")?.substring(7);

    let isSystemAdmin = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        if (payload.role === "SYSTEM_ADMIN") {
          isSystemAdmin = true;
        }
      } catch {
        // Continue for public/self-serve onboarding
      }
    }

    const bodyResult = await safeParseBody(request, onboardInstituteSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = bodyResult.data;

    // Determine tenantId slug
    let baseSlug = data.tenantId
      ? data.tenantId.toLowerCase().trim()
      : generateTenantSlug(data.name);

    if (!baseSlug) baseSlug = "school";

    let tenantId = baseSlug;
    let collisionCount = 1;
    while (await prisma.tenant.findUnique({ where: { tenantId } })) {
      tenantId = `${baseSlug}-${collisionCount++}`;
    }

    // Check if admin email already exists globally in any user account
    const existingUser = await prisma.user.findFirst({
      where: { email: data.adminEmail },
    });

    if (existingUser) {
      return badRequest("Administrator email is already registered", [
        {
          field: "adminEmail",
          code: "duplicate",
          message: "A user with this email address already exists. Please choose a different admin email.",
        },
      ]);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    // Determine initial academic year dates
    const startDate = new Date(data.academicStartDate);
    const endDate = new Date(data.academicEndDate);

    const subscriptionStatus = isSystemAdmin
      ? data.subscriptionStatus
      : "TRIAL";

    // Atomic Provisioning Transaction with extended timeout
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Create Tenant
        const newTenant = await tx.tenant.create({
          data: {
            tenantId,
            name: data.name,
            schoolCode: data.schoolCode || undefined,
            address: data.address,
            phone: data.phone || undefined,
            email: data.email || data.adminEmail,
            website: data.website || undefined,
            motto: data.motto || undefined,
            establishedYear: data.establishedYear || undefined,
            currency: data.currency,
            currencySymbol: data.currencySymbol,
            taxRate: data.taxRate,
            dateFormat: data.dateFormat,
            timeFormat: data.timeFormat,
            timezone: data.timezone,
            firstDayOfWeek: data.firstDayOfWeek,
            gradingSystem: data.gradingSystem,
            subscriptionStatus,
          },
        });

        // 2. Create Super Admin User
        const adminUser = await tx.user.create({
          data: {
            tenantId: newTenant.tenantId,
            name: data.adminName,
            email: data.adminEmail,
            hash: hashedPassword,
            role: "SUPER_ADMIN",
            isActive: true,
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        });

        // 3. Create Initial Academic Year
        const academicYear = await tx.academicYear.create({
          data: {
            tenantId: newTenant.tenantId,
            yearId: `AY-${new Date().getFullYear()}`,
            label: data.academicYearLabel,
            startDate,
            endDate,
            isClosed: false,
          },
        });

        // 4. Seed Initial Class Structure & Sections
        const classDefinitions = getClassTemplateDefinitions(data.classTemplate ?? "K_12");
        const uniqueSubjectsMap = new Map<string, TemplateClassDef["subjects"][number]>();
        for (const def of classDefinitions) {
          for (const sub of def.subjects) {
            if (!uniqueSubjectsMap.has(sub.code)) {
              uniqueSubjectsMap.set(sub.code, sub);
            }
          }
        }

        const subjectRowIdsByCode = new Map<string, string>();
        await Promise.all(
          Array.from(uniqueSubjectsMap.values()).map(async (subject) => {
            const created = await tx.subject.create({
              data: {
                tenantId: newTenant.tenantId,
                subjectId: `SUB-${subject.code}`,
                name: subject.name,
                code: subject.code,
                category: subject.type === "THEORY" ? "COMPULSORY" : "ELECTIVE",
              },
            });
            subjectRowIdsByCode.set(subject.code, created.id);
          })
        );

        let createdClassesCount = 0;
        let createdSectionsCount = 0;

        for (const def of classDefinitions) {
          const cls = await tx.class.create({
            data: {
              tenantId: newTenant.tenantId,
              classId: def.code,
              name: def.name,
              classNumber: def.sequence,
            },
          });
          createdClassesCount++;

          const sectionPromises = def.sections.map((secName, secIdx) => {
            const shortName =
              secName.replace(/^Section\s+/i, "").trim() || String(secIdx + 1);
            return tx.section.create({
              data: {
                tenantId: newTenant.tenantId,
                sectionId: `SEC-${def.code}-${shortName}`,
                classId: cls.id,
                name: secName,
                shortName,
                capacity: 45,
              },
            });
          });
          await Promise.all(sectionPromises);
          createdSectionsCount += def.sections.length;

          const classSubjectPromises = def.subjects.map((sub, subIdx) => {
            const subjectRowId = subjectRowIdsByCode.get(sub.code);
            if (!subjectRowId) return Promise.resolve(null);
            return tx.classSubject.create({
              data: {
                tenantId: newTenant.tenantId,
                classId: cls.id,
                subjectId: subjectRowId,
                isCompulsory: true,
                sortOrder: subIdx,
              },
            });
          });
          await Promise.all(classSubjectPromises);
        }

        return {
          tenant: newTenant,
          adminUser,
          academicYear,
          seededStats: {
            classes: createdClassesCount,
            sections: createdSectionsCount,
          },
        };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    return successResponse(
      {
        tenantId: result.tenant.tenantId,
        name: result.tenant.name,
        adminEmail: result.adminUser.email,
        adminName: result.adminUser.name,
        currency: result.tenant.currency,
        academicYear: result.academicYear.label,
        classesCount: result.seededStats.classes,
        sectionsCount: result.seededStats.sections,
        subscriptionStatus: result.tenant.subscriptionStatus,
      },
      "Institute onboarded and provisioned successfully!",
      201
    );
  } catch (error) {
    return handleApiError(error, "Failed to onboard institute");
  }
}
