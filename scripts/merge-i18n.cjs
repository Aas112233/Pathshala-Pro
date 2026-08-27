/* One-off i18n merger: adds new namespaces to all four locale files. */
const fs = require("fs");
const path = require("path");

const MESSAGES_DIR = path.join(__dirname, "..", "src", "messages");

// ---------- ENGLISH ----------
const en = {
  accounting: {
    accounts: {
      title: "Bank Accounts & Cash Registers",
      description: "Institutional Treasury, Bank Ledgers, and Petty Cash Registers",
      addAccount: "Add Bank / Cash Account",
      linkNewAccount: "Link New Account",
      totalLiquidBalance: "Total Institutional Liquid Balance",
      acrossAccounts: "Across {count} registered institutional bank accounts & petty cash registers",
      noAccountsTitle: "No accounts registered yet",
      noAccountsDescription: "Link your school's bank accounts or campus petty cash register to start reconciling fee collections and expense disbursements.",
      addFirstAccount: "Add First Account",
      accountIban: "Account / IBAN Number",
      currentBalance: "Current Balance:",
      accountTypeChecking: "Current / Checking Account",
      accountTypeSavings: "Savings & Deposit Account",
      accountTypePettyCash: "Campus Petty Cash Register"
    },
    accountsForm: {
      title: "Add Institutional Bank / Cash Account",
      subtitle: "Treasury & Accounts Management",
      description: "Register an institutional bank account or cash register for fee collections and disbursements.",
      nameLabel: "Account Title *",
      namePlaceholder: "e.g. Main Operations Account",
      bankLabel: "Bank / Institution Name *",
      bankPlaceholder: "e.g. Habib Bank Ltd / City Bank",
      ibanLabel: "Account / IBAN Number *",
      ibanPlaceholder: "e.g. PK36HABB00012345678901",
      branchLabel: "Branch Name / Code",
      branchPlaceholder: "e.g. Main Campus Branch (#0421)",
      typeLabel: "Account Type",
      typeChecking: "Current / Checking Account",
      typeSavings: "Savings & Deposit Account",
      typePettyCash: "Campus Petty Cash Register",
      openingBalanceLabel: "Opening Balance ({code})",
      errRequired: "Please fill in account name, bank name, and account number.",
      created: "Account registered successfully!",
      createFailed: "Failed to create account"
    },
    expenses: {
      title: "Institutional Expense Ledger",
      description: "Accounts Payable & Campus Operational Expenditures",
      recordExpense: "Record New Expense",
      deleteConfirm: "Are you sure you want to delete expense voucher {expenseNumber}?",
      deleted: "Expense {expenseNumber} deleted",
      deleteFailed: "Failed to delete expense",
      colVoucher: "VOUCHER #",
      colTitlePayee: "EXPENSE TITLE & PAYEE",
      payee: "Payee: {name}",
      directExpense: "Direct Campus Expense",
      billNo: "• Bill #{receiptNumber}",
      colCategory: "CATEGORY",
      generalCategory: "General",
      colAmount: "AMOUNT",
      colMethod: "METHOD",
      colDate: "DATE",
      allCategories: "All Categories",
      allMethods: "All Payment Methods",
      methodCash: "Petty Cash",
      methodBank: "Bank Account",
      methodCheque: "Cheque",
      methodDigital: "Digital Wallet",
      clearFilters: "Clear Filters",
      tableTitle: "Expense Voucher Register",
      showingRecords: "Showing {count} records",
      filterPlaceholder: "Filter expense records...",
      metricExpenditure: "EXPENDITURE",
      totalExpenses: "Total Recorded Expenses",
      vouchersCount: "{count} Vouchers",
      metricStructure: "STRUCTURE",
      activeCategories: "Active Categories",
      expenseStreams: "Expense Streams",
      metricAudit: "AUDIT STATUS",
      avgVoucherSize: "Average Voucher Size",
      perTransaction: "Per Transaction",
      metricTreasury: "TREASURY",
      cashVsBank: "Cash vs Bank",
      reconciled: "Reconciled",
      multiChannel: "Multi-Channel"
    },
    expensesForm: {
      title: "Record Institutional Expense",
      subtitle: "Accounts Payable & Operations",
      description: "Record campus operational expenses, utility bills, maintenance charges, and procurement costs.",
      titleLabel: "Expense Title / Description *",
      titlePlaceholder: "e.g. Electricity Bill - Main Campus or Science Lab Chemicals",
      categoryLabel: "Expense Category *",
      amountLabel: "Amount ({symbol}) *",
      amountPlaceholder: "0.00",
      paymentMethodLabel: "Payment Method",
      methodCash: "Petty Cash Register",
      methodBank: "Bank Account Transfer",
      methodCheque: "Bank Cheque / Pay Order",
      methodDigital: "Digital / Online Wallet",
      dateLabel: "Expense Date *",
      payeeLabel: "Payee / Vendor Name",
      payeePlaceholder: "e.g. National Power Grid / ABC Stationers",
      receiptLabel: "Bill / Receipt Number",
      receiptPlaceholder: "e.g. INV-98421",
      notesLabel: "Internal Audit Notes",
      notesPlaceholder: "Additional details, approval remarks, or purchase authorization references...",
      errTitle: "Please provide an expense title.",
      errCategory: "Please select an expense category.",
      errAmount: "Please enter a valid expense amount.",
      created: "Operational expense recorded successfully!",
      createFailed: "Failed to record expense"
    },
    profitLoss: {
      title: "Institutional Profit & Loss (P&L) Statement",
      description: "Comprehensive Revenue vs Operating Expenditure & Surplus Analysis",
      fiscalYear: "Fiscal Year {year}",
      printStatement: "Print Statement",
      revenue: "Total Operating Revenue",
      revenueCaption: "Realized Student Tuition & Fee Collections",
      salaries: "Staff Payroll & Salaries",
      salariesCaption: "Faculty, Administration, and Support Staff",
      operations: "Campus Operational Expenses",
      operationsCaption: "Utilities, Maintenance, Rent, and Transport",
      netSurplus: "Net Operating Surplus",
      surplusCaption: "Revenue minus all operating expenditures",
      operatingMargin: "Operating Margin: {margin}%",
      revenueBreakdown: "Revenue Stream Breakdown",
      noRevenueData: "No fee collection data in this fiscal period.",
      feeType: "{type} Fee",
      expenditureBreakdown: "Operational Expenditure Breakdown",
      noExpenseData: "No operational expenses recorded in this period.",
      ledgerTitle: "12-Month Comparative Financial Ledger ({year})",
      monthlyAuditView: "Monthly Audit View",
      thMonth: "MONTH",
      thRevenue: "REVENUE ({symbol})",
      thSalaries: "SALARIES ({symbol})",
      thOperations: "OPERATIONS ({symbol})",
      thTotalExpenses: "TOTAL EXPENSES ({symbol})",
      thNetSurplus: "NET SURPLUS ({symbol})"
    }
  },
  onboarding: {
    registerTitle: "Register Your Educational Institute",
    registerSubtitle: "Launch your dedicated Pathshala-Pro cloud ERP in under 2 minutes.",
    stepProfile: "Profile",
    stepLocalization: "Localization",
    stepAcademics: "Academics",
    stepAdminAccount: "Admin Account",
    stepLaunch: "Launch",
    profileSection: "Institute Profile",
    profileSectionDesc: "Provide official identity and campus location.",
    instituteName: "Institute Full Name *",
    instituteNamePh: "e.g. Beaconhouse International Academy",
    slugLabel: "School Slug / Subdomain *",
    slugPh: "e.g. beaconhouse-intl",
    schoolCodeLabel: "School Code / Reg Number",
    schoolCodePh: "e.g. BIA-2026",
    addressLabel: "Address *",
    addressPh: "Campus address, City, District",
    phoneLabel: "Contact Phone",
    phonePh: "e.g. +92 51 1234567",
    emailLabel: "Official Email",
    emailPh: "e.g. info@beaconhouse.edu",
    regionalSection: "Regional & Financial Settings",
    regionalSectionDesc: "Configure your local currency, timezone, and calendar.",
    currencyLabel: "Currency *",
    currencySymbolLabel: "Currency Symbol",
    timezoneLabel: "Timezone *",
    dateFormatLabel: "Date Format",
    academicsSection: "Academic Structure",
    academicsSectionDesc: "Define the initial session dates and select an initial class curriculum structure.",
    academicYearLabel: "Academic Year *",
    academicYearPh: "e.g. 2026-2027",
    startDate: "Start Date *",
    endDate: "End Date *",
    gradeStructureLabel: "Choose Initial Grade Structure",
    adminSection: "Principal / Super Admin Account",
    adminSectionDesc: "Create the master administrator login credentials to manage your ERP.",
    fullNameLabel: "Full Name *",
    fullNamePh: "e.g. Dr. Tariq Mahmood",
    loginEmailLabel: "Login Email *",
    loginEmailPh: "e.g. principal@beaconhouse.edu",
    masterPasswordLabel: "Master Password *",
    generatePassword: "Generate Secure Password",
    passwordPh: "Minimum 6 characters",
    reviewTitle: "Review & Confirm Setup",
    reviewDesc: "Verify all configurations before instant cloud provisioning.",
    schoolDetails: "School Details",
    financialRegional: "Financial & Regional",
    academicSystem: "Academic System",
    superAdmin: "Super Admin",
    welcomeTitle: "Welcome to Pathshala-Pro, {name}!",
    welcomeSubtitle: "Your school ERP instance is live with full database isolation, academic year {year}, and initial grade structures.",
    instituteTenantId: "Institute Tenant ID:",
    superAdminEmail: "Super Admin Email:",
    classesSeeded: "Classes Seeded:",
    classesCount: "{count} Classes",
    detailsCopied: "School details copied",
    copyCredentials: "Copy Credentials",
    goToLoginPortal: "Go to Login Portal",
    provisioning: "Provisioning School ERP...",
    completeLaunch: "Complete & Launch School",
    copyright: "© {year} Pathshala-Pro ERP. All rights reserved.",
    toast: {
      passwordGenerated: "Generated secure temporary password",
      errName: "Please enter the institute name",
      errAddress: "Please enter the school address",
      errYearLabel: "Please provide an academic year label",
      errDates: "Please select session start and end dates",
      errFullName: "Please enter your full name",
      errEmail: "Please enter a valid administrator email",
      errPassword: "Password must be at least 6 characters",
      provisionFailed: "Failed to provision institute",
      success: "School registered successfully!",
      networkError: "Network error during onboarding"
    },
    templates: {
      K_12: {
        label: "K-12 Comprehensive",
        description: "Playgroup, Nursery, KG, Grades 1-10 with Sections & Core Subjects",
        count: "13 Classes"
      },
      PRIMARY_1_5: {
        label: "Primary School (1–5)",
        description: "Grades 1 to 5 with sections and primary curriculum",
        count: "5 Classes"
      },
      MIDDLE_6_8: {
        label: "Middle School (6–8)",
        description: "Grades 6 to 8 with sections and middle curriculum",
        count: "3 Classes"
      },
      SECONDARY_9_10: {
        label: "Secondary / Matric (9–10)",
        description: "Matriculation grades with science and arts streams",
        count: "2 Classes"
      },
      HIGHER_SEC_11_12: {
        label: "Higher Secondary (11–12)",
        description: "Intermediate grades with subject groups",
        count: "2 Grades + 4 Streams"
      },
      O_A_LEVELS: {
        label: "Cambridge (O / A Levels)",
        description: "Cambridge pathway with O Level and A Level years",
        count: "5 Years"
      },
      MADRASA: {
        label: "Madrasa / Religious Institute",
        description: "Islamic studies levels with core religious curriculum",
        count: "4 Levels"
      },
      CUSTOM: {
        label: "Custom (Blank Start)",
        description: "Start with a blank structure and configure everything yourself",
        count: "0 Classes"
      }
    }
  },
  saasAdmin: {
    billing: {
      title: "SaaS Subscriptions & Billing Engine",
      description: "Global Multi-Tenant Revenue, MRR/ARR Tracking, and Plan Lifecycle Controls",
      loadFailed: "Failed to load SaaS billing data",
      networkError: "Network error",
      statusUpdated: "Status updated to {status}",
      statusUpdateFailed: "Failed to update status",
      colSchool: "SCHOOL & TENANT ID",
      colPlan: "PLAN TIER",
      colStatus: "STATUS",
      colPupils: "PUPILS",
      studentsCount: "{count} Students",
      colRevenue: "EST. MONTHLY REVENUE",
      pricePerMonth: "${price}/mo",
      colLifecycle: "LIFECYCLE ACTIONS",
      activate: "Activate",
      suspend: "Suspend",
      estimatedMrr: "Estimated MRR",
      mrrCaption: "Monthly Recurring Revenue",
      estimatedArr: "Estimated ARR",
      arrCaption: "Annualized Run-Rate",
      activePaidSchools: "Active Paid Schools",
      conversionRate: "{rate}% conversion rate",
      activeTrials: "Active Trials",
      trialsCaption: "30-day evaluation instances",
      tableTitle: "School Tenant Subscriptions",
      managingInstances: "Managing {count} school instances",
      searchPlaceholder: "Search school name or tenant ID..."
    },
    tenantDetail: {
      loadFailed: "Failed to load tenant details",
      loadNetworkError: "Network error loading school telemetry",
      impersonateSuccess: "Logged in as {name}",
      impersonateFailed: "Failed to impersonate tenant",
      supportSessionError: "Error initiating support session",
      loadingTelemetry: "Loading school 360° telemetry...",
      notFound: "School Not Found",
      backToTenants: "Back to Tenants Directory",
      editConfiguration: "Edit Configuration",
      loginAsAdmin: "Login As School Admin",
      metricStudents: "Enrolled Students",
      metricStudentsCaption: "Active pupil profiles",
      metricStaff: "Faculty & Staff",
      metricStaffCaption: "Teaching & operations staff",
      metricFees: "Fee Throughput",
      voucherThroughput: "Across {count} generated vouchers",
      metricUsers: "System Users",
      metricUsersCaption: "Principals, Clerks & Admins",
      subscriptionControls: "SaaS Subscription & Plan Controls",
      currentStatus: "Current Status",
      currentStatusCaption: "Subscription lifecycle state for this school",
      operatingCurrency: "Operating Currency",
      timezoneRegion: "Timezone & Region",
      gradingScale: "Grading Scale",
      dateFormat: "Standard Date Format",
      adminsCardTitle: "School Administrators & Staff Accounts",
      accountsBadge: "{count} Accounts",
      lastLogin: "Login: {date}",
      neverLoggedIn: "Never logged in"
    },
    onboard: {
      title: "Onboard New Educational Institute",
      subtitle: "SaaS Multi-Tenant Provisioning",
      description: "Register, configure regional localization, initialize academic periods, and provision school admin access.",
      stepProfile: "Institute Profile",
      stepRegion: "Region & Currency",
      stepAcademics: "Academic System",
      stepCredentials: "Admin Credentials",
      stepReview: "Review & Launch",
      slugHelper: "Unique identifier used for multi-tenant isolation.",
      adminSectionTitle: "Institute Super Admin Account",
      adminSectionDesc: "This account will have master administrative privileges over school configurations, finance, admissions, and user management.",
      autoGenerate: "Auto-generate",
      passwordPh: "Enter password or auto-generate",
      subscriptionTrial: "30-Day Free Trial",
      subscriptionActive: "Active (Paid Enterprise SaaS)",
      reviewInstitute: "Institute Details",
      reviewFinancial: "Regional & Financial",
      reviewCurrency: "Currency: {code} ({symbol})",
      reviewTimezone: "Timezone: {timezone}",
      reviewDateFormat: "Date Format: {format}",
      reviewGrading: "Grading: {grading}",
      reviewAcademic: "Academic Setup",
      reviewSession: "Session: {label}",
      reviewDates: "Dates: {start} to {end}",
      reviewSuperAdmin: "Super Administrator",
      reviewEmail: "Email: {email}",
      readyTitle: "{name} is Ready!",
      readySubtitle: "The school instance has been provisioned with database isolation, academic year {year}, and seeded structure.",
      tenantSlugId: "Tenant Slug / ID:",
      adminLogin: "Admin Login:",
      classesInitialized: "Classes Initialized:",
      subscriptionLabel: "Subscription:",
      credentialsCopied: "Credentials copied to clipboard",
      copyDetails: "Copy Details",
      finishReturn: "Finish & Return",
      provisioningInfra: "Provisioning Infrastructure...",
      provisionNow: "Provision Institute Now",
      toast: {
        passwordGenerated: "Generated secure temporary password",
        errName: "Please enter the institute name",
        errAddress: "Please enter the school address",
        errYearLabel: "Please provide an academic year label",
        errDates: "Please select session start and end dates",
        errAdminName: "Please enter the administrator's name",
        errEmail: "Please enter a valid administrator email",
        errPassword: "Password must be at least 6 characters",
        provisionFailed: "Failed to provision institute",
        success: "Institute successfully onboarded!",
        networkError: "Network error during onboarding"
      }
    },
    editTenant: {
      title: "Configure School: {name}",
      subtitle: "Tenant ID: {id}",
      description: "Update core institutional metadata, active subscription status, regional currencies, and tax parameters.",
      nameLabel: "School Name *",
      subscriptionStatusLabel: "Subscription Status *",
      statusActive: "ACTIVE (Full Subscription Paid)",
      statusTrial: "TRIAL (30-Day Free Evaluation)",
      statusSuspended: "SUSPENDED (Access Blocked)",
      statusExpired: "EXPIRED (Renewal Required)",
      currencyLabel: "Operating Currency",
      taxRateLabel: "Tax Rate (%)",
      errNameRequired: "School name is required",
      updateFailed: "Failed to update tenant configuration",
      updated: "School configuration updated successfully!",
      updateNetworkError: "Network error updating tenant"
    },
    impersonation: {
      supportMode: "System Admin Support Mode: Viewing as {schoolName} ({tenantId}).",
      exitImpersonation: "Exit Impersonation",
      exitSuccess: "Returned to System Admin console",
      exitFailed: "Failed to exit impersonation",
      exitError: "Error exiting impersonation"
    }
  },
  feesExtras: {
    batchInvoice: {
      title: "Batch Fee Invoice Generator",
      subtitle: "Automated Accounts Receivable",
      description: "Issue monthly or term fee vouchers in bulk across classes with automatic historical arrears rollover.",
      generatedTitle: "{count} Vouchers Generated!",
      generatedSubtitle: "All students have been billed with sequential voucher numbers and arrears protection.",
      totalInvoicedLabel: "Total Invoiced Volume:",
      arrearsRolledLabel: "Historical Arrears Rolled:",
      dueDateResultLabel: "Payment Due Date:",
      doneReturn: "Done & Return to Ledger",
      academicYearLabel: "Academic Year",
      closedSuffix: "(Closed)",
      activeSuffix: "(Active)",
      feeTypeLabel: "Fee Type",
      feeMonthly: "Monthly Tuition Fee",
      feeAdmission: "Admission / Registration Fee",
      feeExam: "Examination & Assessment Fee",
      feeTransport: "Transport & Bus Van Fee",
      feeHostel: "Hostel & Boarding Fee",
      feeDevelopment: "Annual Development Charges",
      scopeLabel: "Billing Target Scope",
      scopeSchool: "Entire School",
      scopeClass: "Specific Class",
      scopeSection: "Specific Section",
      selectClassLabel: "Select Grade / Class",
      chooseClass: "Choose Class...",
      selectSectionLabel: "Select Section",
      chooseSection: "Choose Section...",
      baseFeeLabel: "Base Fee per Student ({symbol})",
      dueDateLabel: "Payment Due Date",
      carryForwardLabel: "Carry Forward Historical Unpaid Arrears",
      carryForwardHelper: "Automatically calculates each student's outstanding balance from prior months and adds it directly into their new voucher.",
      generating: "Generating Invoices...",
      generateNow: "Generate Batch Vouchers Now",
      errSelectYear: "Please select an active academic year.",
      errAmount: "Base fee amount must be greater than 0.",
      generateFailed: "Failed to generate batch invoices",
      generateSuccess: "Batch invoices generated successfully!"
    }
  },
  attendanceExtras: {
    fastGrid: {
      cardTitle: "Fast-Grid Daily Attendance Sheet",
      cardSubtitle: "Rapid 1-click batch marking with absentee notification queue.",
      allClasses: "All Classes",
      totalCount: "Total: {count}",
      presentCount: "Present: {count} ({rate}%)",
      absentCount: "Absent: {count}",
      lateCount: "Late: {count}",
      markAllPresent: "Mark All Present",
      markAllAbsent: "Mark All Absent",
      saveAttendance: "Save Attendance",
      loadingStudents: "Loading students for fast grid...",
      noStudents: "No active students found matching the selected class filter.",
      rollNo: "• Roll #{roll}",
      statusExcused: "Excused",
      markAs: "Mark as {status}",
      notePlaceholder: "Add note (e.g. sick leave)...",
      markedAll: "Marked all students as {status}",
      noStudentsToSave: "No students to save attendance for.",
      saveFailed: "Failed to save attendance",
      savedSummary: "Attendance recorded! {present} Present, {absent} Absent ({rate}%)",
      networkError: "Network error saving attendance"
    }
  },
  resultsExtras: {
    initializeTitle: "Initialize Results Entry",
    initializeDesc: "Click below to load the student list for results entry",
    bulkActionsTitle: "Bulk Actions",
    bulkActionsDesc: "Quick actions for all students",
    marksMax: "Enter marks for each student (Max: {max})",
    exceededMax: "Marks cannot exceed {maxMarks}",
    selectFirst: "Please select exam and subject",
    nothingToSave: "No results to save. Mark at least one student as present.",
    savedForStudents: "Saved results for {count} students",
    saveFailed: "Failed to save results",
    colRollNo: "Roll No"
  }
};

// ---------- URDU ----------
const ur = {
  accounting: {
    accounts: {
      title: "بینک اکاؤنٹس اور کیش رجسٹر",
      description: "ادارہ جاتی خزانہ، بینک کھاتے، اور پیٹی کیش رجسٹر",
      addAccount: "بینک / کیش اکاؤنٹ شامل کریں",
      linkNewAccount: "نیا اکاؤنٹ لنک کریں",
      totalLiquidBalance: "کل ادارہ جاتی دستیاب رقم",
      acrossAccounts: "{count} رجسٹرڈ بینک اکاؤنٹس اور پیٹی کیش رجسٹرز پر مشتمل",
      noAccountsTitle: "ابھی کوئی اکاؤنٹ رجسٹرڈ نہیں",
      noAccountsDescription: "فیس وصولی اور اخراجات کے ملاپ کے لیے اپنے اسکول کے بینک اکاؤنٹس یا کیمپس پیٹی کیش رجسٹر لنک کریں۔",
      addFirstAccount: "پہلا اکاؤنٹ شامل کریں",
      accountIban: "اکاؤنٹ / آئیبان نمبر",
      currentBalance: "موجودہ بیلنس:",
      accountTypeChecking: "کرنٹ / چیکنگ اکاؤنٹ",
      accountTypeSavings: "سیونگ اور ڈپازٹ اکاؤنٹ",
      accountTypePettyCash: "کیمپس پیٹی کیش رجسٹر"
    },
    accountsForm: {
      title: "ادارہ جاتی بینک / کیش اکاؤنٹ شامل کریں",
      subtitle: "خزانہ اور اکاؤنٹس مینجمنٹ",
      description: "فیس وصولی اور ادائیگیوں کے لیے ادارہ جاتی بینک اکاؤنٹ یا کیش رجسٹر درج کریں۔",
      nameLabel: "اکاؤنٹ کا نام *",
      namePlaceholder: "مثلاً مرکزی آپریشنز اکاؤنٹ",
      bankLabel: "بینک / ادارے کا نام *",
      bankPlaceholder: "مثلاً حبیب بینک لمیٹڈ / سٹی بینک",
      ibanLabel: "اکاؤنٹ / آئیبان نمبر *",
      ibanPlaceholder: "مثلاً PK36HABB00012345678901",
      branchLabel: "برانچ کا نام / کوڈ",
      branchPlaceholder: "مثلاً مین کیمپس برانچ (#0421)",
      typeLabel: "اکاؤنٹ کی قسم",
      typeChecking: "کرنٹ / چیکنگ اکاؤنٹ",
      typeSavings: "سیونگ اور ڈپازٹ اکاؤنٹ",
      typePettyCash: "کیمپس پیٹی کیش رجسٹر",
      openingBalanceLabel: "ابتدائی بیلنس ({code})",
      errRequired: "براہ کرم اکاؤنٹ کا نام، بینک کا نام، اور اکاؤنٹ نمبر درج کریں۔",
      created: "اکاؤنٹ کامیابی سے رجسٹر ہو گیا!",
      createFailed: "اکاؤنٹ بنانے میں ناکامی"
    },
    expenses: {
      title: "ادارہ جاتی اخراجات کا رجسٹر",
      description: "ادائیگی واجب الادا اور کیمپس آپریشنل اخراجات",
      recordExpense: "نیا خراج درج کریں",
      deleteConfirm: "کیا آپ واقعی خرچ واؤچر {expenseNumber} حذف کرنا چاہتے ہیں؟",
      deleted: "خرچ {expenseNumber} حذف ہو گیا",
      deleteFailed: "خرچ حذف کرنے میں ناکامی",
      colVoucher: "واوچر #",
      colTitlePayee: "خرچ کا عنوان اور ادائیگی وصول کنندہ",
      payee: "وصول کنندہ: {name}",
      directExpense: "براہ راست کیمپس خرچ",
      billNo: "• بل #{receiptNumber}",
      colCategory: "قسم",
      generalCategory: "عمومی",
      colAmount: "رقم",
      colMethod: "طریقہ",
      colDate: "تاریخ",
      allCategories: "تمام اقسام",
      allMethods: "تمام ادائیگی کے طریقے",
      methodCash: "پیٹی کیش",
      methodBank: "بینک اکاؤنٹ",
      methodCheque: "چیک",
      methodDigital: "ڈیجیٹل والٹ",
      clearFilters: "فلٹرز صاف کریں",
      tableTitle: "خرچ واؤچر رجسٹر",
      showingRecords: "{count} ریکارڈ دکھائے جا رہے ہیں",
      filterPlaceholder: "خرچ ریکارڈ فلٹر کریں...",
      metricExpenditure: "اخراجات",
      totalExpenses: "کل درج شدہ اخراجات",
      vouchersCount: "{count} واؤچرز",
      metricStructure: "ڈھانچہ",
      activeCategories: "فعال اقسام",
      expenseStreams: "خرچ کے ذرائع",
      metricAudit: "آڈٹ اسٹیٹس",
      avgVoucherSize: "اوسط واؤچر سائز",
      perTransaction: "فی لین دین",
      metricTreasury: "خزانہ",
      cashVsBank: "نقد بمقابلہ بینک",
      reconciled: "مطابقت شدہ",
      multiChannel: "ملٹی چینل"
    },
    expensesForm: {
      title: "ادارہ جاتی خرچ درج کریں",
      subtitle: "ادائیگی واجب الادا اور آپریشنز",
      description: "کیمپس آپریشنل اخراجات، یوٹیلیٹی بل، مرمت، اور خریداری کی لاگت درج کریں۔",
      titleLabel: "خرچ کا عنوان / تفصیل *",
      titlePlaceholder: "مثلاً بجلی کا بل - مین کیمپس",
      categoryLabel: "خرچ کی قسم *",
      amountLabel: "رقم ({symbol}) *",
      amountPlaceholder: "0.00",
      paymentMethodLabel: "ادائیگی کا طریقہ",
      methodCash: "پیٹی کیش رجسٹر",
      methodBank: "بینک ٹرانسفر",
      methodCheque: "بینک چیک / پے آرڈر",
      methodDigital: "ڈیجیٹل / آن لائن والٹ",
      dateLabel: "خرچ کی تاریخ *",
      payeeLabel: "ادائیگی وصول کنندہ / فروش",
      payeePlaceholder: "مثلاً نیشنل پاور گرڈ",
      receiptLabel: "بل / رسید نمبر",
      receiptPlaceholder: "مثلاً INV-98421",
      notesLabel: "اندرونی آڈٹ نوٹس",
      notesPlaceholder: "اضافی تفصیلات یا منظوری کے حوالے...",
      errTitle: "براہ کرم خرچ کا عنوان درج کریں۔",
      errCategory: "براہ کرم خرچ کی قسم منتخب کریں۔",
      errAmount: "براہ کرم درست رقم درج کریں۔",
      created: "آپریشنل خرچ کامیابی سے درج ہو گیا!",
      createFailed: "خرچ درج کرنے میں ناکامی"
    },
    profitLoss: {
      title: "ادارہ جاتی نفع و نقصان کا بیان",
      description: "آمدنی بمقابلہ آپریشنل اخراجات اور سرپلس کا جامع تجزیہ",
      fiscalYear: "مالی سال {year}",
      printStatement: "بیان پرنٹ کریں",
      revenue: "کل آپریشنل آمدنی",
      revenueCaption: "وصول شدہ فیس اور ٹیوشن",
      salaries: "عملہ تنخواہیں",
      salariesCaption: "اساتذہ، انتظامیہ، اور معاون عملہ",
      operations: "کیمپس آپریشنل اخراجات",
      operationsCaption: "یوٹیلیٹیز، مرمت، کرایہ، اور ٹرانسپورٹ",
      netSurplus: "خالص آپریشنل سرپلس",
      surplusCaption: "کل آمدنی منہا تمام آپریشنل اخراجات",
      operatingMargin: "آپریٹنگ مارجن: {margin}%",
      revenueBreakdown: "آمدنی کے ذرائع کا تجزیہ",
      noRevenueData: "اس مالی عرصے میں کوئی فیس وصولی ڈیٹا نہیں۔",
      feeType: "{type} فیس",
      expenditureBreakdown: "آپریشنل اخراجات کا تجزیہ",
      noExpenseData: "اس عرصے میں کوئی آپریشنل اخراجات درج نہیں۔",
      ledgerTitle: "12 ماہانہ مالیاتی موازنہ رجسٹر ({year})",
      monthlyAuditView: "ماہانہ آڈٹ نظارہ",
      thMonth: "ماہ",
      thRevenue: "آمدنی ({symbol})",
      thSalaries: "تنخواہیں ({symbol})",
      thOperations: "آپریشنز ({symbol})",
      thTotalExpenses: "کل اخراجات ({symbol})",
      thNetSurplus: "خالص سرپلس ({symbol})"
    }
  },
  onboarding: {
    registerTitle: "اپنے تعلیمی ادارے کا اندراج کریں",
    registerSubtitle: "دو منٹ میں اپنا مخصوص Pathshala-Pro کلاؤڈ ERP launch کریں۔",
    stepProfile: "پروفائل",
    stepLocalization: "مقامی ترتیبات",
    stepAcademics: "تعلیمی",
    stepAdminAccount: "ایڈمن اکاؤنٹ",
    stepLaunch: "اجراء",
    profileSection: "ادارے کی پروفائل",
    profileSectionDesc: "سرکاری شناخت اور کیمپس کا مقام فراہم کریں۔",
    instituteName: "ادارے کا مکمل نام *",
    instituteNamePh: "مثلاً بیکن ہاؤس انٹرنیشنل اکیڈمی",
    slugLabel: "اسکول سلگ / سب ڈومین *",
    slugPh: "مثلاً beaconhouse-intl",
    schoolCodeLabel: "اسکول کوڈ / رجسٹریشن نمبر",
    schoolCodePh: "مثلاً BIA-2026",
    addressLabel: "پتہ *",
    addressPh: "کیمپس کا پتہ، شہر، ضلع",
    phoneLabel: "رابطہ فون",
    phonePh: "مثلاً +92 51 1234567",
    emailLabel: "سرکاری ای میل",
    emailPh: "مثلاً info@beaconhouse.edu",
    regionalSection: "علاقائی اور مالیاتی ترتیبات",
    regionalSectionDesc: "اپنی مقامی کرنسی، ٹائم زون، اور کیلنڈر ترتیب دیں۔",
    currencyLabel: "کرنسی *",
    currencySymbolLabel: "کرنسی علامت",
    timezoneLabel: "ٹائم زون *",
    dateFormatLabel: "تاریخ کا فارمیٹ",
    academicsSection: "تعلیمی ڈھانچہ",
    academicsSectionDesc: "ابتدائی سیشن کی تاریخیں متعین کریں اور جماعتوں کا نصاب منتخب کریں۔",
    academicYearLabel: "تعلیمی سال *",
    academicYearPh: "مثلاً 2026-2027",
    startDate: "آغاز کی تاریخ *",
    endDate: "اختتام کی تاریخ *",
    gradeStructureLabel: "ابتدائی جماعت کا ڈھانچہ منتخب کریں",
    adminSection: "پرنسپل / سپر ایڈمن اکاؤنٹ",
    adminSectionDesc: "اپن ERP کے انتظام کے لیے ماسٹر ایڈمن لاگ ان کیredentials بنائیں۔",
    fullNameLabel: "پورا نام *",
    fullNamePh: "مثلاً ڈاکٹر طارق محمود",
    loginEmailLabel: "لاگ ان ای میل *",
    loginEmailPh: "مثلاً principal@beaconhouse.edu",
    masterPasswordLabel: "ماسٹر پاس ورڈ *",
    generatePassword: "محفوظ پاس ورڈ بنائیں",
    passwordPh: "کم از کم 6 حروف",
    reviewTitle: "جائزہ لیں اور تصدیق کریں",
    reviewDesc: "فوری کلاؤڈ اجراء سے پہلے تمام ترتیبات کی تصدیق کریں۔",
    schoolDetails: "اسکول کی تفصیلات",
    financialRegional: "مالی و علاقائی",
    academicSystem: "تعلیمی نظام",
    superAdmin: "سپر ایڈمن",
    welcomeTitle: "Pathshala-Pro میں خوش آمدید، {name}!",
    welcomeSubtitle: "آپ کا اسکول ERP انسٹانس مکمل ڈیٹابیس آئسولیشن، تعلیمی سال {year}، اور ابتدائی جماعت کے ڈھانچے کے ساتھ لائیو ہے۔",
    instituteTenantId: "ادارہ ٹیننٹ ID:",
    superAdminEmail: "سپر ایڈمن ای میل:",
    classesSeeded: "شامل کردہ جماعتیں:",
    classesCount: "{count} جماعتیں",
    detailsCopied: "اسکول کی تفصیلات کاپی ہو گئیں",
    copyCredentials: "اسناد کاپی کریں",
    goToLoginPortal: "لاگ ان پورٹل پر جائیں",
    provisioning: "اسکول ERP تیار کیا جا رہا ہے...",
    completeLaunch: "مکمل کریں اور اسکول launch کریں",
    copyright: "© {year} Pathshala-Pro ERP۔ جملہ حقوق محفوظ ہیں۔",
    toast: {
      passwordGenerated: "محفوظ عارضی پاس ورڈ تیار ہو گیا",
      errName: "براہ کرم ادارے کا نام درج کریں",
      errAddress: "براہ کرم اسکول کا پتہ درج کریں",
      errYearLabel: "براہ کرم تعلیمی سال کا لیبل دیں",
      errDates: "براہ کرم سیشن کی آغاز و اختتام کی تاریخیں منتخب کریں",
      errFullName: "براہ کرم اپنا پورا نام درج کریں",
      errEmail: "براہ کرم درست ایڈمن ای میل درج کریں",
      errPassword: "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے",
      provisionFailed: "ادارہ تیار کرنے میں ناکامی",
      success: "اسکول کامیابی سے رجسٹر ہو گیا!",
      networkError: "اندراج کے دوران نیٹ ورک خرابی"
    },
    templates: {
      K_12: { label: "K-12 جامع", description: "پلے گروپ، نرسری، KG، جماعتی 1-10 سیکشنز اور بنیادی مضامین کے ساتھ", count: "13 جماعتیں" },
      PRIMARY_1_5: { label: "پرائمری اسکول (1–5)", description: "جماعتی 1 تا 5 سیکشنز اور پرائمری نصاب کے ساتھ", count: "5 جماعتیں" },
      MIDDLE_6_8: { label: "مڈل اسکول (6–8)", description: "جماعتی 6 تا 8 سیکشنز اور مڈل نصاب کے ساتھ", count: "3 جماعتیں" },
      SECONDARY_9_10: { label: "ثانوی / میٹرک (9–10)", description: "سائنس اور آرٹس گروپس کے ساتھ میٹرک جماعتیں", count: "2 جماعتیں" },
      HIGHER_SEC_11_12: { label: "ہائر سیکنڈری (11–12)", description: "مضامین کے گروپس کے ساتھ انٹرمیڈیٹ جماعتیں", count: "2 جماعتیں + 4 گروپس" },
      O_A_LEVELS: { label: "کیمبرج (O / A Levels)", description: "O Level اور A Level سالوں کے ساتھ کیمبرج راہ", count: "5 سال" },
      MADRASA: { label: "مدرسہ / مذہبی ادارہ", description: "بنیادی مذہبی نصاب کے ساتھ اسلامیات کی سطحیں", count: "4 سطحیں" },
      CUSTOM: { label: "کسٹم (خالی آغاز)", description: "خالی ڈھانچے سے آغاز کریں اور سب خود ترتیب دیں", count: "0 جماعتیں" }
    }
  },
  saasAdmin: {
    billing: {
      title: "SaaS سبسکرپشنز اور بلنگ انجن",
      description: "عالمی ملٹی ٹیننٹ آمدنی، MRR/ARR ٹریکنگ، اور پلان لائف سائیکل کنٹرولز",
      loadFailed: "SaaS بلنگ ڈیٹا لوڈ کرنے میں ناکامی",
      networkError: "نیٹ ورک خرابی",
      statusUpdated: "اسٹیٹس {status} میں اپڈیٹ ہو گیا",
      statusUpdateFailed: "اسٹیٹس اپڈیٹ کرنے میں ناکامی",
      colSchool: "اسکول اور ٹیننٹ ID",
      colPlan: "پلان ٹیئر",
      colStatus: "اسٹیٹس",
      colPupils: "طلبہ",
      studentsCount: "{count} طلبہ",
      colRevenue: "متوقع ماہانہ آمدنی",
      pricePerMonth: "${price}/ماہ",
      colLifecycle: "لائف سائیکل ایکشنز",
      activate: "فعال کریں",
      suspend: "معطل کریں",
      estimatedMrr: "متوقع MRR",
      mrrCaption: "ماہانہ بار بار ہونے والی آمدنی",
      estimatedArr: "متوقع ARR",
      arrCaption: "سالانہ شرح",
      activePaidSchools: "فعال ادائیگی والے اسکولز",
      conversionRate: "{rate}% کنورژن ریٹ",
      activeTrials: "فعال ٹرائلز",
      trialsCaption: "30 روزہ جانچ کے انسٹانسز",
      tableTitle: "اسکول ٹیننٹ سبسکرپشنز",
      managingInstances: "{count} اسکول انسٹانسز کا انتظام",
      searchPlaceholder: "اسکول کا نام یا ٹیننٹ ID تلاش کریں..."
    },
    tenantDetail: {
      loadFailed: "ٹیننٹ کی تفصیلات لوڈ کرنے میں ناکامی",
      loadNetworkError: "اسکول ٹیلی میٹری لوڈ کرنے میں نیٹ ورک خرابی",
      impersonateSuccess: "{name} کے طور پر لاگ ان ہوئے",
      impersonateFailed: "ٹیننٹ امپرسونیٹ کرنے میں ناکامی",
      supportSessionError: "سپورٹ سیشن شروع کرنے میں خرابی",
      loadingTelemetry: "اسکول 360° ٹیلی میٹری لوڈ ہو رہی ہے...",
      notFound: "اسکول نہیں ملا",
      backToTenants: "ٹیننٹس ڈائریکٹری پر واپس",
      editConfiguration: "ترتیبات میں ترمیم",
      loginAsAdmin: "اسکول ایڈمن کے طور پر لاگ ان",
      metricStudents: "insideرج شدہ طلبہ",
      metricStudentsCaption: "فعال طلبہ پروفائلز",
      metricStaff: "اساتذہ اور عملہ",
      metricStaffCaption: "تدریسی اور آپریشنز عملہ",
      metricFees: "فیس کارکردگی",
      voucherThroughput: "{count} بنائے گئے واؤچرز پر مشتمل",
      metricUsers: "سسٹم صارفین",
      metricUsersCaption: "پرنسپلز، کلرکس اور ایڈمنز",
      subscriptionControls: "SaaS سبسکرپشن اور پلان کنٹرولز",
      currentStatus: "موجودہ اسٹیٹس",
      currentStatusCaption: "اس اسکول کی سبسکرپشن لائف سائیکل حالت",
      operatingCurrency: "آپریٹنگ کرنسی",
      timezoneRegion: "ٹائم زون اور علاقہ",
      gradingScale: "گریڈنگ اسکیل",
      dateFormat: "معیاری تاریخ فارمیٹ",
      adminsCardTitle: "اسکول ایڈمنسٹریٹرز اور عملہ اکاؤنٹس",
      accountsBadge: "{count} اکاؤنٹس",
      lastLogin: "لاگ ان: {date}",
      neverLoggedIn: "کبھی لاگ ان نہیں ہوئے"
    },
    onboard: {
      title: "نیا تعلیمی ادارہ داخل کریں",
      subtitle: "SaaS ملٹی ٹیننٹ فراہمی",
      description: "رجسٹریشن، علاقائی مقامی ترتیب، تعلیمی ادوار کی ابتدا، اور اسکول ایڈمن رسائی کی فراہمی۔",
      stepProfile: "ادارہ پروفائل",
      stepRegion: "خطہ اور کرنسی",
      stepAcademics: "تعلیمی نظام",
      stepCredentials: "ایڈمن اسناد",
      stepReview: "جائزہ اور اجراء",
      slugHelper: "ملٹی ٹیننٹ آئسولیشن کے لیے منفرد شناخت۔",
      adminSectionTitle: "ادارہ سپر ایڈمن اکاؤنٹ",
      adminSectionDesc: "اس اکاؤنٹ کو اسکول کی ترتیبات، مالیات، داخلے، اور صارف انتظام پر ماسٹر انتظامی اختیارات حاصل ہوں گے۔",
      autoGenerate: "خودکار تخلیق",
      passwordPh: "پاس ورڈ درج کریں یا خودکار بنائیں",
      subscriptionTrial: "30 روزہ مفت ٹرائل",
      subscriptionActive: "فعال (ادا شدہ انٹرپرائز SaaS)",
      reviewInstitute: "ادارے کی تفصیلات",
      reviewFinancial: "علاقائی و مالیاتی",
      reviewCurrency: "کرنسی: {code} ({symbol})",
      reviewTimezone: "ٹائم زون: {timezone}",
      reviewDateFormat: "تاریخ فارمیٹ: {format}",
      reviewGrading: "گریڈنگ: {grading}",
      reviewAcademic: "تعلیمی ترتیب",
      reviewSession: "سیشن: {label}",
      reviewDates: "تاریخاں: {start} تا {end}",
      reviewSuperAdmin: "سپر ایڈمنسٹریٹر",
      reviewEmail: "ای میل: {email}",
      readyTitle: "{name} تیار ہے!",
      readySubtitle: "اسکول انسٹانس ڈیٹابیس آئسولیشن، تعلیمی سال {year}، اور seeded ڈھانچے کے ساتھ فراہم کیا گیا ہے۔",
      tenantSlugId: "ٹیننٹ سلگ / ID:",
      adminLogin: "ایڈمن لاگ ان:",
      classesInitialized: "جماعتیں متعین ہوئیں:",
      subscriptionLabel: "سبسکرپشن:",
      credentialsCopied: "اسناد کلپ بورڈ پر کاپی ہو گئیں",
      copyDetails: "تفصیلات کاپی کریں",
      finishReturn: "مکمل کریں اور واپس جائیں",
      provisioningInfra: "انفراسٹرکچر تیار کیا جا رہا ہے...",
      provisionNow: "ابھی ادارہ فراہم کریں",
      toast: {
        passwordGenerated: "محفوظ عارضی پاس ورڈ تیار ہو گیا",
        errName: "براہ کرم ادارے کا نام درج کریں",
        errAddress: "براہ کرم اسکول کا پتہ درج کریں",
        errYearLabel: "براہ کرم تعلیمی سال کا لیبل دیں",
        errDates: "براہ کرم سیشن کی آغاز و اختتام کی تاریخیں منتخب کریں",
        errAdminName: "براہ کرم ایڈمنسٹریٹر کا نام درج کریں",
        errEmail: "براہ کرم درست ایڈمن ای میل درج کریں",
        errPassword: "پاس ورڈ کم از کم 6 حروف کا ہونا چاہیے",
        provisionFailed: "ادارہ تیار کرنے میں ناکامی",
        success: "ادارہ کامیابی سے داخل ہو گیا!",
        networkError: "اندراج کے دوران نیٹ ورک خرابی"
      }
    },
    editTenant: {
      title: "اسکول ترتیب دیں: {name}",
      subtitle: "ٹیننٹ ID: {id}",
      description: "بنیادی ادارہ میٹا ڈیٹا، فعال سبسکرپشن اسٹیٹس، علاقائی کرنسیاں، اور ٹیک پیرامیٹرز اپڈیٹ کریں۔",
      nameLabel: "اسکول کا نام *",
      subscriptionStatusLabel: "سبسکرپشن اسٹیٹس *",
      statusActive: "ACTIVE (مکمل سبسکرپشن ادا شدہ)",
      statusTrial: "TRIAL (30 روزہ مفت جانچ)",
      statusSuspended: "SUSPENDED (رسائی بند)",
      statusExpired: "EXPIRED (تجدید ضروری)",
      currencyLabel: "آپریٹنگ کرنسی",
      taxRateLabel: "ٹیک ریٹ (%)",
      errNameRequired: "اسکول کا نام ضروری ہے",
      updateFailed: "ٹیننٹ ترتیبات اپڈیٹ کرنے میں ناکامی",
      updated: "اسکول کی ترتیبات کامیابی سے اپڈیٹ ہو گئیں!",
      updateNetworkError: "ٹیننٹ اپڈیٹ کرنے میں نیٹ ورک خرابی"
    },
    impersonation: {
      supportMode: "سسٹم ایڈمن سپورٹ موڈ: {schoolName} ({tenantId}) کے طور پر دیکھ رہے ہیں۔",
      exitImpersonation: "امپرسونیشن ختم کریں",
      exitSuccess: "سسٹم ایڈمن کنسول پر واپس",
      exitFailed: "امپرسونیشن ختم کرنے میں ناکامی",
      exitError: "امپرسونیشن ختم کرنے میں خرابی"
    }
  },
  feesExtras: {
    batchInvoice: {
      title: "بیچ فیس انوائس جنریٹر",
      subtitle: "خودکار حسابات وصولی",
      description: "جماعتیں میں بلک میں ماہانہ یا مدتی فیس واؤچرز جاری کریں مع خودکار تاریخی بقایا جات کے۔",
      generatedTitle: "{count} واؤچرز تیار ہوئے!",
      generatedSubtitle: "تمام طلبہ کو ترتیب وار واؤچر نمبرز اور بقایا تحفظ کے ساتھ بل کیا گیا۔",
      totalInvoicedLabel: "کل انوائس حجم:",
      arrearsRolledLabel: "تاریخی بقایا جات شامل:",
      dueDateResultLabel: "ادائیگی کی آخری تاریخ:",
      doneReturn: "مکمل اور رجسٹر پر واپس",
      academicYearLabel: "تعلیمی سال",
      closedSuffix: "(بند)",
      activeSuffix: "(فعال)",
      feeTypeLabel: "فیس کی قسم",
      feeMonthly: "ماہانہ ٹیوشن فیس",
      feeAdmission: "داخلہ / رجسٹریشن فیس",
      feeExam: "امتحان اور جانچ فیس",
      feeTransport: "ٹرانسپورٹ اور بس فیس",
      feeHostel: "ہاسٹل اور بورڈنگ فیس",
      feeDevelopment: "سالانہ ڈیولپمنٹ چارجز",
      scopeLabel: "بلنگ ہدف دائرہ",
      scopeSchool: "پورا اسکول",
      scopeClass: "مخصوص جماعت",
      scopeSection: "مخصوص سیکشن",
      selectClassLabel: "جماعت منتخب کریں",
      chooseClass: "جماعت منتخب کریں...",
      selectSectionLabel: "سیکشن منتخب کریں",
      chooseSection: "سیکشن منتخب کریں...",
      baseFeeLabel: "فی طالب علم بنیادی فیس ({symbol})",
      dueDateLabel: "ادائیگی کی آخری تاریخ",
      carryForwardLabel: "تاریخی غیر ادا شدہ بقایا جات آگے بڑھائیں",
      carryForwardHelper: "ہر طالب علم کا پچھلے مہینوں کا باقیدہ خودکار حساب لگا کر نئے واؤچر میں شامل کرتا ہے۔",
      generating: "انوائسز تیار ہو رہی ہیں...",
      generateNow: "ابھی بیچ واؤچرز بنائیں",
      errSelectYear: "براہ کرم فعال تعلیمی سال منتخب کریں۔",
      errAmount: "بنیادی فیس رقم صفر سے زیادہ ہونی چاہیے۔",
      generateFailed: "بیچ انوائسز بنانے میں ناکامی",
      generateSuccess: "بیچ انوائسز کامیابی سے تیار ہو گئیں!"
    }
  },
  attendanceExtras: {
    fastGrid: {
      cardTitle: "فاسٹ گرڈ روزانہ حاضری شیٹ",
      cardSubtitle: "تیز ایک کلک بلک مارکنگ مع غیر حاضر اطلاع قطار۔",
      allClasses: "تمام جماعتیں",
      totalCount: "کل: {count}",
      presentCount: "حاضر: {count} ({rate}%)",
      absentCount: "غیر حاضر: {count}",
      lateCount: "تاخیر: {count}",
      markAllPresent: "سب حاضر نشان زد کریں",
      markAllAbsent: "سب غیر حاضر نشان زد کریں",
      saveAttendance: "حاضری محفوظ کریں",
      loadingStudents: "فاسٹ گرڈ کے لیے طلبہ لوڈ ہو رہے ہیں...",
      noStudents: "منتخب جماعت فلٹر سے مماثل کوئی فعال طلبہ نہیں ملے۔",
      rollNo: "• رول #{roll}",
      statusExcused: "رخصت",
      markAs: "{status} کے طور پر نشان زد کریں",
      notePlaceholder: "نوٹ شامل کریں (مثلاً بیماری کی چھٹی)...",
      markedAll: "تمام طلبہ {status} نشان زد ہوئے",
      noStudentsToSave: "حاضری محفوظ کرنے کے لیے کوئی طالب علم نہیں۔",
      saveFailed: "حاضری محفوظ کرنے میں ناکامی",
      savedSummary: "حاضری درج ہو گئی! {present} حاضر، {absent} غیر حاضر ({rate}%)",
      networkError: "حاضری محفوظ کرنے میں نیٹ ورک خرابی"
    }
  },
  resultsExtras: {
    initializeTitle: "نتائج اندراج کی ابتدا",
    initializeDesc: "نتائج اندراج کے لیے طلبہ کی فہرست لوڈ کرنے نیچے کلک کریں",
    bulkActionsTitle: "بلک ایکشنز",
    bulkActionsDesc: "تمام طلبہ کے لیے فوری ایکشنز",
    marksMax: "ہر طالب علم کے نمبر درج کریں (زیادہ سے زیادہ: {max})",
    exceededMax: "نمبر {maxMarks} سے زیادہ نہیں ہو سکتے",
    selectFirst: "براہ کرم امتحان اور مضمون منتخب کریں",
    nothingToSave: "محفوظ کرنے کو کوئی نتیجہ نہیں۔ کم از کم ایک طالب علم حاضر نشان زد کریں۔",
    savedForStudents: "{count} طلبہ کے نتائج محفوظ ہوئے",
    saveFailed: "نتائج محفوظ کرنے میں ناکامی",
    colRollNo: "رول نمبر"
  }
};

// ---------- HINDI ----------
const hi = JSON.parse(JSON.stringify(en));
{
  const a = hi.accounting;
  a.accounts.title = "बैंक खाते और कैश रजिस्टर";
  a.accounts.description = "संस्थागत कोष, बैंक खाते और पेटी कैश रजिस्टर";
  a.accounts.addAccount = "बैंक / कैश खाता जोड़ें";
  a.accounts.linkNewAccount = "नया खाता जोड़ें";
  a.accounts.totalLiquidBalance = "कुल संस्थागत तरल शेष";
  a.accounts.acrossAccounts = "{count} पंजीकृत बैंक खातों और पेटी कैश रजिस्टरों में";
  a.accounts.noAccountsTitle = "अभी कोई खाता पंजीकृत नहीं";
  a.accounts.noAccountsDescription = "फीस संग्रहण और व्यय भुगतान मिलान शुरू करने के लिए अपने स्कूल के बैंक खाते या कैंपस पेटी कैश रजिस्टर जोड़ें।";
  a.accounts.addFirstAccount = "पहला खाता जोड़ें";
  a.accounts.accountIban = "खाता / IBAN नंबर";
  a.accounts.currentBalance = "वर्तमान शेष:";
  a.accounts.accountTypeChecking = "चालू / चेकिंग खाता";
  a.accounts.accountTypeSavings = "बचत और जमा खाता";
  a.accounts.accountTypePettyCash = "कैंपस पेटी कैश रजिस्टर";
  a.accountsForm.title = "संस्थागत बैंक / कैश खाता जोड़ें";
  a.accountsForm.subtitle = "कोष और लेखा प्रबंधन";
  a.accountsForm.description = "फीस संग्रहण और भुगतानों हेतु संस्थागत बैंक खाता या कैश रजिस्टर पंजीकृत करें।";
  a.accountsForm.nameLabel = "खाता शीर्षक *"; a.accountsForm.namePlaceholder = "जैसे मुख्य परिचालन खाता";
  a.accountsForm.bankLabel = "बैंक / संस्था का नाम *"; a.accountsForm.bankPlaceholder = "जैसे हबीब बैंक लि. / सिटी बैंक";
  a.accountsForm.ibanLabel = "खाता / IBAN नंबर *"; a.accountsForm.ibanPlaceholder = "जैसे PK36HABB00012345678901";
  a.accountsForm.branchLabel = "शाखा नाम / कोड"; a.accountsForm.branchPlaceholder = "जैसे मुख्य कैंपस शाखा (#0421)";
  a.accountsForm.typeLabel = "खाता प्रकार"; a.accountsForm.typeChecking = "चालू / चेकिंग खाता"; a.accountsForm.typeSavings = "बचत और जमा खाता"; a.accountsForm.typePettyCash = "कैंपस पेटी कैश रजिस्टर";
  a.accountsForm.openingBalanceLabel = "प्रारंभिक शेष ({code})";
  a.accountsForm.errRequired = "कृपया खाता नाम, बैंक नाम, और खाता नंबर भरें।";
  a.accountsForm.created = "खाता सफलतापूर्वक पंजीकृत हुआ!";
  a.accountsForm.createFailed = "खाता बनाने में विफल";
  a.expenses.title = "संस्थागत व्यय बही";
  a.expenses.description = "देय भुगतान और कैंपस परिचालन व्यय";
  a.expenses.recordExpense = "नया व्यय दर्ज करें";
  a.expenses.deleteConfirm = "क्या आप वाकई व्यय वाउचर {expenseNumber} हटाना चाहते हैं?";
  a.expenses.deleted = "व्यय {expenseNumber} हटा दिया गया";
  a.expenses.deleteFailed = "व्यय हटाने में विफल";
  a.expenses.colVoucher = "वाउचर #";
  a.expenses.colTitlePayee = "व्यय शीर्षक और भुगतान पाने वाला";
  a.expenses.payee = "भुगतान पाने वाला: {name}";
  a.expenses.directExpense = "प्रत्यक्ष कैंपस व्यय";
  a.expenses.billNo = "• बिल #{receiptNumber}";
  a.expenses.colCategory = "श्रेणी"; a.expenses.generalCategory = "सामान्य";
  a.expenses.colAmount = "राशि"; a.expenses.colMethod = "विधि"; a.expenses.colDate = "दिनांक";
  a.expenses.allCategories = "सभी श्रेणियाँ"; a.expenses.allMethods = "सभी भुगतान विधियाँ";
  a.expenses.methodCash = "पेटी कैश"; a.expenses.methodBank = "बैंक खाता"; a.expenses.methodCheque = "चेक"; a.expenses.methodDigital = "डिजिटल वॉलेट";
  a.expenses.clearFilters = "फ़िल्टर साफ़ करें";
  a.expenses.tableTitle = "व्यय वाउचर रजिस्टर";
  a.expenses.showingRecords = "{count} रिकॉर्ड दिखाए जा रहे हैं";
  a.expenses.filterPlaceholder = "व्यय रिकॉर्ड फ़िल्टर करें...";
  a.expenses.metricExpenditure = "व्यय"; a.expenses.totalExpenses = "कुल दर्ज व्यय"; a.expenses.vouchersCount = "{count} वाउचर";
  a.expenses.metricStructure = "संरचना"; a.expenses.activeCategories = "सक्रिय श्रेणियाँ"; a.expenses.expenseStreams = "व्यय धाराएँ";
  a.expenses.metricAudit = "ऑडिट स्थिति"; a.expenses.avgVoucherSize = "औसत वाउचर आकार"; a.expenses.perTransaction = "प्रति लेन-देन";
  a.expenses.metricTreasury = "कोष"; a.expenses.cashVsBank = "नकद बनाम बैंक"; a.expenses.reconciled = "मेल खाता"; a.expenses.multiChannel = "मल्टी-चैनल";
  a.expensesForm.title = "संस्थागत व्यय दर्ज करें";
  a.expensesForm.subtitle = "देय भुगतान और परिचालन";
  a.expensesForm.description = "कैंपस परिचालन व्यय, उपयोगिता बिल, रखरखाव और खरीद लागत दर्ज करें।";
  a.expensesForm.titleLabel = "व्यय शीर्षक / विवरण *"; a.expensesForm.titlePlaceholder = "जैसे बिजली बिल - मुख्य कैंपस";
  a.expensesForm.categoryLabel = "व्यय श्रेणी *"; a.expensesForm.amountLabel = "राशि ({symbol}) *"; a.expensesForm.amountPlaceholder = "0.00";
  a.expensesForm.paymentMethodLabel = "भुगतान विधि"; a.expensesForm.methodCash = "पेटी कैश रजिस्टर"; a.expensesForm.methodBank = "बैंक ट्रांसफर"; a.expensesForm.methodCheque = "बैंक चेक / पे ऑर्डर"; a.expensesForm.methodDigital = "डिजिटल / ऑनलाइन वॉलेट";
  a.expensesForm.dateLabel = "व्यय दिनांक *";
  a.expensesForm.payeeLabel = "भुगतान पाने वाला / विक्रेता"; a.expensesForm.payeePlaceholder = "जैसे नेशनल पावर ग्रिड";
  a.expensesForm.receiptLabel = "बिल / रसीद नंबर"; a.expensesForm.receiptPlaceholder = "जैसे INV-98421";
  a.expensesForm.notesLabel = "आंतरिक ऑडिट नोट्स"; a.expensesForm.notesPlaceholder = "अतिरिक्त विवरण या अनुमोदन संदर्भ...";
  a.expensesForm.errTitle = "कृपया व्यय शीर्षक दें।"; a.expensesForm.errCategory = "कृपया व्यय श्रेणी चुनें।"; a.expensesForm.errAmount = "कृपया मान्य राशि दर्ज करें।";
  a.expensesForm.created = "परिचालन व्यय सफलतापूर्वक दर्ज हुआ!"; a.expensesForm.createFailed = "व्यय दर्ज करने में विफल";
  a.profitLoss.title = "संस्थागत लाभ-हानि विवरण";
  a.profitLoss.description = "राजस्य बनाम परिचालन व्यय और अधिशेष का व्यापक विश्लेषण";
  a.profitLoss.fiscalYear = "वित्तीय वर्ष {year}"; a.profitLoss.printStatement = "विवरण प्रिंट करें";
  a.profitLoss.revenue = "कुल परिचालन राजस्य"; a.profitLoss.revenueCaption = "प्राप्त छात्र ट्यूशन और फीस संग्रह";
  a.profitLoss.salaries = "कर्मचारी वेतन"; a.profitLoss.salariesCaption = "संकाय, प्रशासन, और सहायक कर्मचारी";
  a.profitLoss.operations = "कैंपस परिचालन व्यय"; a.profitLoss.operationsCaption = "उपयोगिताएँ, रखरखाव, किराया, परिवहन";
  a.profitLoss.netSurplus = "शुद्ध परिचालन अधिशेष"; a.profitLoss.surplusCaption = "कुल राजस्य घटा सभी परिचालन व्यय";
  a.profitLoss.operatingMargin = "परिचालन मार्जिन: {margin}%";
  a.profitLoss.revenueBreakdown = "राजस्य धारा विवरण"; a.profitLoss.noRevenueData = "इस वित्तीय अवधि में फीस डेटा नहीं।"; a.profitLoss.feeType = "{type} शुल्क";
  a.profitLoss.expenditureBreakdown = "परिचालन व्यय विवरण"; a.profitLoss.noExpenseData = "इस अवधि में कोई परिचालन व्यय दर्ज नहीं।";
  a.profitLoss.ledgerTitle = "12-मासिक तुलनात्मक वित्तीय बही ({year})"; a.profitLoss.monthlyAuditView = "मासिक ऑडिट दृश्य";
  a.profitLoss.thMonth = "माह"; a.profitLoss.thRevenue = "राजस्य ({symbol})"; a.profitLoss.thSalaries = "वेतन ({symbol})"; a.profitLoss.thOperations = "परिचालन ({symbol})"; a.profitLoss.thTotalExpenses = "कुल व्यय ({symbol})"; a.profitLoss.thNetSurplus = "शुद्ध अधिशेष ({symbol})";
}

// ---------- BENGALI ----------
const bn = JSON.parse(JSON.stringify(en));
{
  const a = bn.accounting;
  a.accounts.title = "ব্যাংক হিসাব ও ক্যাশ রেজিস্টার";
  a.accounts.description = "প্রাতিষ্ঠানিক কোষাগার, ব্যাংক খাতা ও পেটি ক্যাশ রেজিস্টার";
  a.accounts.addAccount = "ব্যাংক / ক্যাশ হিসাব যোগ করুন";
  a.accounts.linkNewAccount = "নতুন হিসাব যুক্ত করুন";
  a.accounts.totalLiquidBalance = "মোট প্রাতিষ্ঠানিক তহবিল";
  a.accounts.acrossAccounts = "{count}টি নিবন্ধিত ব্যাংক হিসাব ও পেটি ক্যাশ রেজিস্টার জুড়ে";
  a.accounts.noAccountsTitle = "এখনও কোনো হিসাব নিবন্ধিত নয়";
  a.accounts.noAccountsDescription = "ফি আদায় ও ব্যয় মিলন শুরু করতে আপনার স্কুলের ব্যাংক হিসাব বা ক্যাম্পাস পেটি ক্যাশ রেজিস্টার যুক্ত করুন।";
  a.accounts.addFirstAccount = "প্রথম হিসাব যোগ করুন";
  a.accounts.accountIban = "হিসাব / IBAN নম্বর";
  a.accounts.currentBalance = "বর্তমান ব্যালেন্স:";
  a.accounts.accountTypeChecking = "চলতি / চেকিং হিসাব";
  a.accounts.accountTypeSavings = "সঞ্চয় ও জমা হিসাব";
  a.accounts.accountTypePettyCash = "ক্যাম্পাস পেটি ক্যাশ রেজিস্টার";
  a.accountsForm.title = "প্রাতিষ্ঠানিক ব্যাংক / ক্যাশ হিসাব যোগ করুন";
  a.accountsForm.subtitle = "কোষাগার ও হিসাব ব্যবস্থাপনা";
  a.accountsForm.description = "ফি আদায় ও পরিশোধের জন্য প্রাতিষ্ঠানিক ব্যাংক হিসাব বা ক্যাশ রেজিস্টার নিবন্ধন করুন।";
  a.accountsForm.nameLabel = "হিসাবের শিরোনাম *"; a.accountsForm.namePlaceholder = "যেমন প্রধান পরিচালনা হিসাব";
  a.accountsForm.bankLabel = "ব্যাংক / প্রতিষ্ঠানের নাম *"; a.accountsForm.bankPlaceholder = "যেমন হবিব ব্যাংক লিমিটেড / সিটি ব্যাংক";
  a.accountsForm.ibanLabel = "হিসাব / IBAN নম্বর *"; a.accountsForm.ibanPlaceholder = "যেমন PK36HABB00012345678901";
  a.accountsForm.branchLabel = "শাখার নাম / কোড"; a.accountsForm.branchPlaceholder = "যেমন প্রধান ক্যাম্পাস শাখা (#0421)";
  a.accountsForm.typeLabel = "হিসাবের ধরন"; a.accountsForm.typeChecking = "চলতি / চেকিং হিসাব"; a.accountsForm.typeSavings = "সঞ্চয় ও জমা হিসাব"; a.accountsForm.typePettyCash = "ক্যাম্পাস পেটি ক্যাশ রেজিস্টার";
  a.accountsForm.openingBalanceLabel = "প্রারম্ভিক ব্যালেন্স ({code})";
  a.accountsForm.errRequired = "অনুগ্রহ করে হিসাবের নাম, ব্যাংকের নাম ও হিসাব নম্বর দিন।";
  a.accountsForm.created = "হিসাব সফলভাবে নিবন্ধিত হয়েছে!";
  a.accountsForm.createFailed = "হিসাব তৈরি করতে ব্যর্থ";
  a.expenses.title = "প্রাতিষ্ঠানিক ব্যয় খাতা";
  a.expenses.description = "প্রদেয় ও ক্যাম্পাস পরিচালন ব্যয়";
  a.expenses.recordExpense = "নতুন ব্যয় লিখুন";
  a.expenses.deleteConfirm = "আপনি কি সত্যিই ব্যয় ভাউচার {expenseNumber} মুছতে চান?";
  a.expenses.deleted = "ব্যয় {expenseNumber} মুছে ফেলা হয়েছে";
  a.expenses.deleteFailed = "ব্যয় মুছতে ব্যর্থ";
  a.expenses.colVoucher = "ভাউচার #";
  a.expenses.colTitlePayee = "ব্যয়ের শিরোনাম ও প্রাপক";
  a.expenses.payee = "প্রাপক: {name}";
  a.expenses.directExpense = "সরাসরি ক্যাম্পাস ব্যয়";
  a.expenses.billNo = "• বিল #{receiptNumber}";
  a.expenses.colCategory = "শ্রেণী"; a.expenses.generalCategory = "সাধারণ";
  a.expenses.colAmount = "পরিমাণ"; a.expenses.colMethod = "পদ্ধতি"; a.expenses.colDate = "তারিখ";
  a.expenses.allCategories = "সব শ্রেণী"; a.expenses.allMethods = "সব পেমেন্ট পদ্ধতি";
  a.expenses.methodCash = "পেটি ক্যাশ"; a.expenses.methodBank = "ব্যাংক হিসাব"; a.expenses.methodCheque = "চেক"; a.expenses.methodDigital = "ডিজিটাল ওয়ালেট";
  a.expenses.clearFilters = "ফিল্টার মুছুন";
  a.expenses.tableTitle = "ব্যয় ভাউচার রেজিস্টার";
  a.expenses.showingRecords = "{count}টি রেকর্ড দেখানো হচ্ছে";
  a.expenses.filterPlaceholder = "ব্যয় রেকর্ড ফিল্টার করুন...";
  a.expenses.metricExpenditure = "ব্যয়"; a.expenses.totalExpenses = "মোট নথিভুক্ত ব্যয়"; a.expenses.vouchersCount = "{count} ভাউচার";
  a.expenses.metricStructure = "কাঠামো"; a.expenses.activeCategories = "সক্রিয় শ্রেণী"; a.expenses.expenseStreams = "ব্যয়ের ধারা";
  a.expenses.metricAudit = "অডিট স্টেটাস"; a.expenses.avgVoucherSize = "গড় ভাউচার আকার"; a.expenses.perTransaction = "প্রতি লেনদেনে";
  a.expenses.metricTreasury = "কোষাগার"; a.expenses.cashVsBank = "নগদ বনাম ব্যাংক"; a.expenses.reconciled = "মিলিত"; a.expenses.multiChannel = "মাল্টি-চ্যানেল";
  a.expensesForm.title = "প্রাতিষ্ঠানিক ব্যয় লিখুন";
  a.expensesForm.subtitle = "প্রদেয় ও পরিচালনা";
  a.expensesForm.description = "ক্যাম্পাস পরিচালন ব্যয়, ইউটিলিটি বিল, রক্ষণাবেক্ষণ ও ক্রয় খরচ লিখুন।";
  a.expensesForm.titleLabel = "ব্যয়ের শিরোনাম / বিবরণ *"; a.expensesForm.titlePlaceholder = "যেমন বিদ্যুৎ বিল - প্রধান ক্যাম্পাস";
  a.expensesForm.categoryLabel = "ব্যয়ের শ্রেণী *"; a.expensesForm.amountLabel = "পরিমাণ ({symbol}) *"; a.expensesForm.amountPlaceholder = "0.00";
  a.expensesForm.paymentMethodLabel = "পেমেন্ট পদ্ধতি"; a.expensesForm.methodCash = "পেটি ক্যাশ রেজিস্টার"; a.expensesForm.methodBank = "ব্যাংক ট্রান্সফার"; a.expensesForm.methodCheque = "ব্যাংক চেক / পে অর্ডার"; a.expensesForm.methodDigital = "ডিজিটাল / অনলাইন ওয়ালেট";
  a.expensesForm.dateLabel = "ব্যয়ের তারিখ *";
  a.expensesForm.payeeLabel = "প্রাপক / বিক্রেতার নাম"; a.expensesForm.payeePlaceholder = "যেমন ন্যাশনাল পাওয়ার গ্রিড";
  a.expensesForm.receiptLabel = "বিল / রশিদ নম্বর"; a.expensesForm.receiptPlaceholder = "যেমন INV-98421";
  a.expensesForm.notesLabel = "অভ্যন্তরীণ অডিট নোট"; a.expensesForm.notesPlaceholder = "অতিরিক্ত বিবরণ বা অনুমোদনের রেফারেন্স...";
  a.expensesForm.errTitle = "অনুগ্রহ করে ব্যয়ের শিরোনাম দিন।"; a.expensesForm.errCategory = "অনুগ্রহ করে ব্যয়ের শ্রেণী নির্বাচন করুন।"; a.expensesForm.errAmount = "অনুগ্রহ করে সঠিক পরিমাণ লিখুন।";
  a.expensesForm.created = "পরিচালন ব্যয় সফলভাবে লিখিত হয়েছে!"; a.expensesForm.createFailed = "ব্যয় লিখতে ব্যর্থ";
  a.profitLoss.title = "প্রাতিষ্ঠানিক লাভ-ক্ষতি বিবরণী";
  a.profitLoss.description = "রাজস্ব বনাম পরিচালন ব্যয় ও উদ্বৃত্পের পূর্ণাঙ্গ বিশ্লেষণ";
  a.profitLoss.fiscalYear = "অর্থবছর {year}"; a.profitLoss.printStatement = "বিবরণী প্রিন্ট করুন";
  a.profitLoss.revenue = "মোট পরিচালন রাজস্ব"; a.profitLoss.revenueCaption = "আদায়কৃত টিউশন ও ফি সংগ্রহ";
  a.profitLoss.salaries = "কর্মচারী বেতন"; a.profitLoss.salariesCaption = "শিক্ষক, প্রশাসন ও সহায়ক কর্মচারী";
  a.profitLoss.operations = "ক্যাম্পাস পরিচালন ব্যয়"; a.profitLoss.operationsCaption = "ইউটিলিটি, রক্ষণাবেক্ষণ, ভাড়া, পরিবহন";
  a.profitLoss.netSurplus = "নিট পরিচালন উদ্বৃত্ত"; a.profitLoss.surplusCaption = "মোট রাজস্ব বাদ সব পরিচালন ব্যয়";
  a.profitLoss.operatingMargin = "পরিচালন মার্জিন: {margin}%";
  a.profitLoss.revenueBreakdown = "রাজস্ব প্রবাহ বিশ্লেষণ"; a.profitLoss.noRevenueData = "এই অর্থবছরে কোনো ফি সংগ্রহের তথ্য নেই।"; a.profitLoss.feeType = "{type} ফি";
  a.profitLoss.expenditureBreakdown = "পরিচালন ব্যয় বিশ্লেষণ"; a.profitLoss.noExpenseData = "এই সময়ে কোনো পরিচালন ব্যয় নথিভুক্ত নয়।";
  a.profitLoss.ledgerTitle = "১২-মাসিক তুলনামূলক আর্থিক খাতা ({year})"; a.profitLoss.monthlyAuditView = "মাসিক অডিট দৃশ্য";
  a.profitLoss.thMonth = "মাস"; a.profitLoss.thRevenue = "রাজস্ব ({symbol})"; a.profitLoss.thSalaries = "বেতন ({symbol})"; a.profitLoss.thOperations = "পরিচালনা ({symbol})"; a.profitLoss.thTotalExpenses = "মোট ব্যয় ({symbol})"; a.profitLoss.thNetSurplus = "নিট উদ্বৃত্ত ({symbol})";
}

function mergeDeep(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === "object" && !Array.isArray(target[key])
    ) {
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

for (const [locale, data] of [["en", en], ["ur", ur], ["hi", hi], ["bn", bn]]) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
  mergeDeep(current, data);
  fs.writeFileSync(filePath, JSON.stringify(current, null, 2) + "\n", "utf8");
  console.log(`Updated ${locale}.json`);
}
console.log("Done.");
