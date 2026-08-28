import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
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
import { onboardInstituteSchema, RESERVED_TENANT_SLUGS } from "@/lib/schemas";
import { getClassTemplateDefinitions, generateTenantSlug, type TemplateClassDef } from "@/lib/onboarding-templates";
import {
  seedTenantChartOfAccounts,
  seedTenantFeeHeads,
  seedTenantFiscalCalendar,
  seedTenantVoucherSequences,
  seedTenantPromotionRules,
} from "@/lib/tenant-provisioning";
import bcrypt from "bcryptjs";
import { isPlatformOwnerEmail } from "@/lib/platform-owner";
import { smartRateLimitAsync, dedupeRequestAsync } from "@/lib/rate-limit";

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
    if (user.role !== "SYSTEM_ADMIN" && !isPlatformOwnerEmail(user.email) && !(user as any).impersonatedBy) {
      return unauthorized("Only platform system administrators can access tenant directory.");
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
    // Apply IP-based Rate Limiting & deduplication on public tenant onboarding
    const ip = request.headers.get("x-forwarded-for") || "unknown_ip";

    if (!(await dedupeRequestAsync(`ONBOARD_POST_${ip}`, 3000))) {
      return badRequest("Duplicate onboarding request detected. Please wait a moment.");
    }

    const rateCheck = await smartRateLimitAsync(`ONBOARD_${ip}`, { preset: "auth" });
    if (!rateCheck.success) {
      const minutes = Math.max(1, Math.ceil(rateCheck.retryAfterSeconds / 60));
      return badRequest(`Too many onboarding attempts from this IP. Please try again in ${minutes} minutes.`);
    }

    const token =
      request.cookies.get("auth_token")?.value ||
      request.headers.get("authorization")?.substring(7);

    let isSystemAdmin = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        if (payload.role === "SYSTEM_ADMIN" || isPlatformOwnerEmail(payload.email as string)) {
          isSystemAdmin = true;
        }
      } catch {
        // Continue as public onboarding
      }
    }

    const bodyResult = await safeParseBody(request, onboardInstituteSchema);
    if (!bodyResult.success) return bodyResult.errorResponse;
    const data = onboardInstituteSchema.parse(bodyResult.data);

    // Determine tenantId slug
    let baseSlug = data.tenantId
      ? data.tenantId.toLowerCase().trim()
      : generateTenantSlug(data.name);

    if (!baseSlug) baseSlug = "school";

    // Strict reserved slug check
    if (RESERVED_TENANT_SLUGS.includes(baseSlug as any)) {
      return badRequest("The requested subdomain/slug is reserved by the platform. Please choose a different slug.", [
        {
          field: "tenantId",
          code: "reserved",
          message: `The slug '${baseSlug}' is a protected platform keyword.`,
        },
      ]);
    }

    let tenantId = baseSlug;
    let collisionCount = 1;
    while (await prisma.tenant.findUnique({ where: { tenantId } })) {
      tenantId = `${baseSlug}-${collisionCount++}`;
    }

    if (RESERVED_TENANT_SLUGS.includes(tenantId as any)) {
      return badRequest("The resolved tenant slug is reserved by the platform.");
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

        // 2. Create School Admin User (Highest authority for tenant)
        const adminUser = await tx.user.create({
          data: {
            tenantId: newTenant.tenantId,
            name: data.adminName,
            email: data.adminEmail,
            hash: hashedPassword,
            role: "ADMIN",
            accessLevel: 1,
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
        const createdClassesList: Array<{ id: string; classNumber: number; name: string }> = [];

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
          createdClassesList.push({ id: cls.id, classNumber: def.sequence, name: def.name });

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

        // 5. Seed Promotion Rules for Classes
        const provisioningTx = tx as unknown as Prisma.TransactionClient;
        await seedTenantPromotionRules(provisioningTx, newTenant.tenantId, academicYear.id, createdClassesList);

        // 6. Seed Standard 5-Tier Chart of Accounts
        await seedTenantChartOfAccounts(provisioningTx, newTenant.tenantId, newTenant.currency);

        // 7. Seed Default Fee Heads
        await seedTenantFeeHeads(provisioningTx, newTenant.tenantId);

        // 8. Seed Fiscal Year and 12 Financial Periods Calendar
        const fiscalYearStartMonth = (data as any).fiscalYearStartMonth || (newTenant.currency === "INR" ? 4 : 7);
        await seedTenantFiscalCalendar(provisioningTx, newTenant.tenantId, fiscalYearStartMonth);

        // 9. Seed Atomic Voucher Sequence Counters
        await seedTenantVoucherSequences(provisioningTx, newTenant.tenantId);

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
