// Infrastructure — DB models and repositories
import MongoTenantRepository from './infrastructure/db/repositories/MongoTenantRepository';
import MongoUserRepository from './infrastructure/db/repositories/MongoUserRepository';
import MongoBranchRepository from './infrastructure/db/repositories/MongoBranchRepository';
import MongoTransactionRepository from './infrastructure/db/repositories/MongoTransactionRepository';
import MongoBranchLedgerRepository from './infrastructure/db/repositories/MongoBranchLedgerRepository';
import MongoDeviceSessionRepository from './infrastructure/db/repositories/MongoDeviceSessionRepository';
import MongoCommissionPayableRepository from './infrastructure/db/repositories/MongoCommissionPayableRepository';
import MongoCommissionSettlementRepository from './infrastructure/db/repositories/MongoCommissionSettlementRepository';

// Infrastructure — Services
import MongoAuditService from './infrastructure/services/MongoAuditService';
import SocketNotificationService from './infrastructure/services/SocketNotificationService';

// Use-cases — Auth
import Login from './application/use-cases/auth/Login';
import RefreshToken from './application/use-cases/auth/RefreshToken';

// Use-cases — Branch
import CreateBranch from './application/use-cases/branch/CreateBranch';
import UpdateBranch from './application/use-cases/branch/UpdateBranch';
import GetBranches from './application/use-cases/branch/GetBranches';
import GetBranchLedger from './application/use-cases/branch/GetBranchLedger';
import GetBranchDailyBalances from './application/use-cases/branch/GetBranchDailyBalances';

// Use-cases — User
import CreateUser from './application/use-cases/user/CreateUser';
import UpdateUser from './application/use-cases/user/UpdateUser';
import GetUsers from './application/use-cases/user/GetUsers';
import ResetPassword from './application/use-cases/user/ResetPassword';

// Use-cases — Transaction
import CreateTransaction from './application/use-cases/transaction/CreateTransaction';
import ApproveTransaction from './application/use-cases/transaction/ApproveTransaction';
import RejectTransaction from './application/use-cases/transaction/RejectTransaction';
import CompletePayment from './application/use-cases/transaction/CompletePayment';
import GetTransactions from './application/use-cases/transaction/GetTransactions';
import GetTransaction from './application/use-cases/transaction/GetTransaction';

// Use-cases — Tenant
import CreateTenant from './application/use-cases/tenant/CreateTenant';
import UpdateTenantStatus from './application/use-cases/tenant/UpdateTenantStatus';
import UpdateTenantBranchLimit from './application/use-cases/tenant/UpdateTenantBranchLimit';
import UpdateTenantStaffLimit from './application/use-cases/tenant/UpdateTenantStaffLimit';
import GetTenants from './application/use-cases/tenant/GetTenants';

// Use-cases — Settings
import GetSettings from './application/use-cases/settings/GetSettings';
import UpdateSettings from './application/use-cases/settings/UpdateSettings';

// Use-cases — Dashboard
import GetDashboard from './application/use-cases/dashboard/GetDashboard';

// Use-cases — Reports
import GetReports from './application/use-cases/reports/GetReports';
import ExportReport from './application/use-cases/reports/ExportReport';
import GetLoginReport from './application/use-cases/reports/GetLoginReport';
import GetDailyReport from './application/use-cases/reports/GetDailyReport';
import GetPendingApprovalQueue from './application/use-cases/reports/GetPendingApprovalQueue';
import GetOutstandingPayments from './application/use-cases/reports/GetOutstandingPayments';
import GetRejectedTransactions from './application/use-cases/reports/GetRejectedTransactions';
import GetBranchCollectionReport from './application/use-cases/reports/GetBranchCollectionReport';
import GetBranchFlowMatrix from './application/use-cases/reports/GetBranchFlowMatrix';
import GetDailyTally from './application/use-cases/reports/GetDailyTally';
import GetAllBranchDailyBalances from './application/use-cases/reports/GetAllBranchDailyBalances';
import GetCashPosition from './application/use-cases/reports/GetCashPosition';
import GetStaffReport from './application/use-cases/reports/GetStaffReport';
import GetCommissionOverrideReport from './application/use-cases/reports/GetCommissionOverrideReport';
import GetPeriodComparison from './application/use-cases/reports/GetPeriodComparison';
import GetPaymentMethodReport from './application/use-cases/reports/GetPaymentMethodReport';

// Use-cases — Commission Settlement
import GetCommissionPayables from './application/use-cases/commissionSettlement/GetCommissionPayables';
import GetCommissionSettlements from './application/use-cases/commissionSettlement/GetCommissionSettlements';
import CreateCommissionSettlement from './application/use-cases/commissionSettlement/CreateCommissionSettlement';
import CompleteCommissionSettlement from './application/use-cases/commissionSettlement/CompleteCommissionSettlement';

// Controllers
import CommissionSettlementController from './interfaces/http/controllers/CommissionSettlementController';

// Routes
import commissionSettlementRoutes from './interfaces/http/routes/commission-settlement.routes';

// Use-cases — Branch delete
import DeleteBranch from './application/use-cases/branch/DeleteBranch';

// Use-cases — User suspend
import SuspendUser from './application/use-cases/user/SuspendUser';
import GetUserActiveTransactions from './application/use-cases/user/GetUserActiveTransactions';

// Use-cases — Audit
import GetAuditLogs from './application/use-cases/audit/GetAuditLogs';

// Use-cases — Super Admin
import ResetDevData from './application/use-cases/superAdmin/ResetDevData';

// Use-cases — External Accounts
import CreateExternalAccount from './application/use-cases/externalAccount/CreateExternalAccount';
import GetExternalAccounts from './application/use-cases/externalAccount/GetExternalAccounts';
import UpdateExternalAccount from './application/use-cases/externalAccount/UpdateExternalAccount';
import AddExternalEntry from './application/use-cases/externalAccount/AddExternalEntry';
import GetExternalLedger from './application/use-cases/externalAccount/GetExternalLedger';

// Controllers
import ExternalAccountController from './interfaces/http/controllers/ExternalAccountController';

// Routes
import externalAccountRoutes from './interfaces/http/routes/external-account.routes';

// Use-cases — App Install
import RegisterAppInstall from './application/use-cases/appInstall/RegisterAppInstall';
import RequestAppAccess from './application/use-cases/appInstall/RequestAppAccess';
import ApproveAppAccess from './application/use-cases/appInstall/ApproveAppAccess';
import RejectAppAccess from './application/use-cases/appInstall/RejectAppAccess';
import ListAppAccess from './application/use-cases/appInstall/ListAppAccess';

// Use-cases — Device Sessions
import CreateDeviceSession from './application/use-cases/device/CreateDeviceSession';
import ApproveDeviceSession from './application/use-cases/device/ApproveDeviceSession';
import RejectDeviceSession from './application/use-cases/device/RejectDeviceSession';
import SuspendDeviceSession from './application/use-cases/device/SuspendDeviceSession';
import ListDeviceSessions from './application/use-cases/device/ListDeviceSessions';
import SuspendAllSessions from './application/use-cases/device/SuspendAllSessions';

// Controllers
import AuthController from './interfaces/http/controllers/AuthController';
import DeviceSessionController from './interfaces/http/controllers/DeviceSessionController';
import BranchController from './interfaces/http/controllers/BranchController';
import UserController from './interfaces/http/controllers/UserController';
import TransactionController from './interfaces/http/controllers/TransactionController';
import TenantController from './interfaces/http/controllers/TenantController';
import DashboardController from './interfaces/http/controllers/DashboardController';
import SettingsController from './interfaces/http/controllers/SettingsController';
import ReportController from './interfaces/http/controllers/ReportController';
import AuditLogController from './interfaces/http/controllers/AuditLogController';
import AppInstallController from './interfaces/http/controllers/AppInstallController';

// Routes
import reportRoutes from './interfaces/http/routes/report.routes';
import notificationRoutes from './interfaces/http/routes/notification.routes';
import auditLogRoutes from './interfaces/http/routes/audit-log.routes';
import deviceSessionRoutes from './interfaces/http/routes/device-session.routes';
import appInstallRoutes from './interfaces/http/routes/app-install.routes';

/**
 * Composition root. io = Socket.IO server instance (injected after socket setup).
 * All dependencies wired here — nothing else does `new SomeDependency()`.
 */
export default function buildContainer(io: any) {
  // Repositories
  const tenantRepository = new MongoTenantRepository();
  const userRepository = new MongoUserRepository();
  const branchRepository = new MongoBranchRepository();
  const transactionRepository = new MongoTransactionRepository();
  const branchLedgerRepository = new MongoBranchLedgerRepository();
  const deviceSessionRepository = new MongoDeviceSessionRepository();
  const commissionPayableRepository = new MongoCommissionPayableRepository();
  const commissionSettlementRepository = new MongoCommissionSettlementRepository();

  // Services
  const auditService = new MongoAuditService();
  const notificationService = new SocketNotificationService(io);

  // Device session use-cases (created before loginUseCase so it can be injected)
  const createDeviceSession = new CreateDeviceSession({ deviceSessionRepository, notificationService });
  const approveDeviceSession = new ApproveDeviceSession({ deviceSessionRepository, userRepository, auditService });
  const rejectDeviceSession = new RejectDeviceSession({ deviceSessionRepository, auditService });
  const suspendDeviceSession = new SuspendDeviceSession({ deviceSessionRepository, userRepository, auditService, notificationService });
  const listDeviceSessions = new ListDeviceSessions({ deviceSessionRepository });
  const suspendAllSessions = new SuspendAllSessions({ deviceSessionRepository, userRepository, auditService, notificationService });

  // Use-cases
  const loginUseCase = new Login({ userRepository, tenantRepository, branchRepository, auditService, notificationService, createDeviceSession });
  const refreshTokenUseCase = new RefreshToken({ userRepository, tenantRepository, branchRepository });

  const createBranch = new CreateBranch({ branchRepository, tenantRepository, auditService });
  const updateBranch = new UpdateBranch({ branchRepository, auditService });
  const getBranches = new GetBranches({ branchRepository, tenantRepository });
  const getBranchLedger = new GetBranchLedger({ branchRepository, branchLedgerRepository });
  const getBranchDailyBalances = new GetBranchDailyBalances({ branchRepository, branchLedgerRepository });

  const createUser = new CreateUser({ userRepository, branchRepository, tenantRepository, auditService });
  const updateUser = new UpdateUser({ userRepository, auditService });
  const getUsers = new GetUsers({ userRepository, tenantRepository });
  const resetPassword = new ResetPassword({ userRepository, auditService });

  const createTransaction = new CreateTransaction({ transactionRepository, branchRepository, tenantRepository, notificationService, auditService, branchLedgerRepository });
  const approveTransaction = new ApproveTransaction({ transactionRepository, notificationService, auditService, branchLedgerRepository, branchRepository });
  const rejectTransaction = new RejectTransaction({ transactionRepository, notificationService, auditService, branchLedgerRepository, branchRepository });
  const completePayment = new CompletePayment({ transactionRepository, notificationService, auditService, branchLedgerRepository, branchRepository, tenantRepository, commissionPayableRepository });
  const getTransactions = new GetTransactions({ transactionRepository });
  const getTransaction = new GetTransaction({ transactionRepository });

  const createTenant = new CreateTenant({ tenantRepository });
  const updateTenantStatus = new UpdateTenantStatus({ tenantRepository, notificationService });
  const updateTenantBranchLimit = new UpdateTenantBranchLimit({ tenantRepository, branchRepository });
  const updateTenantStaffLimit = new UpdateTenantStaffLimit({ tenantRepository, userRepository });
  const getTenants = new GetTenants({ tenantRepository });

  const getSettings = new GetSettings({ tenantRepository });
  const updateSettings = new UpdateSettings({ tenantRepository, auditService });

  const getDashboard = new GetDashboard({ transactionRepository, branchRepository });

  const getReports = new GetReports({ transactionRepository });
  const getLoginReport = new GetLoginReport();
  const getDailyReport = new GetDailyReport({ transactionRepository });
  const getPendingApprovalQueue = new GetPendingApprovalQueue({ transactionRepository });
  const getOutstandingPayments = new GetOutstandingPayments({ transactionRepository });
  const getRejectedTransactions = new GetRejectedTransactions({ transactionRepository });
  const getBranchCollectionReport = new GetBranchCollectionReport({ transactionRepository });
  const getBranchFlowMatrix = new GetBranchFlowMatrix({ transactionRepository });
  const getDailyTally = new GetDailyTally({ branchRepository });
  const getAllBranchDailyBalances = new GetAllBranchDailyBalances({ branchRepository });
  const getCashPosition = new GetCashPosition({ branchRepository });
  const getStaffReport = new GetStaffReport({ transactionRepository });
  const getCommissionOverrideReport = new GetCommissionOverrideReport({});
  const getPeriodComparison = new GetPeriodComparison({ transactionRepository });
  const getPaymentMethodReport = new GetPaymentMethodReport({ transactionRepository });
  const exportReport = new ExportReport({
    transactionRepository,
    branchRepository,
    getDailyReportUC: getDailyReport,
    getPendingQueueUC: getPendingApprovalQueue,
    getOutstandingPaymentsUC: getOutstandingPayments,
    getRejectedTransactionsUC: getRejectedTransactions,
    getBranchCollectionReportUC: getBranchCollectionReport,
    getBranchFlowMatrixUC: getBranchFlowMatrix,
    getCashPositionUC: getCashPosition,
    getStaffReportUC: getStaffReport,
    getCommissionOverrideReportUC: getCommissionOverrideReport,
    getPeriodComparisonUC: getPeriodComparison,
    getPaymentMethodReportUC: getPaymentMethodReport,
  });
  const getCommissionPayables = new GetCommissionPayables({ commissionPayableRepository });
  const getCommissionSettlements = new GetCommissionSettlements({ commissionSettlementRepository });
  const createCommissionSettlement = new CreateCommissionSettlement({ commissionPayableRepository, commissionSettlementRepository, branchRepository });
  const completeCommissionSettlement = new CompleteCommissionSettlement({ commissionPayableRepository, commissionSettlementRepository, branchLedgerRepository, auditService });
  const commissionSettlementController = new CommissionSettlementController({ getCommissionPayables, getCommissionSettlements, createCommissionSettlement, completeCommissionSettlement, commissionSettlementRepository });

  const getAuditLogs = new GetAuditLogs();
  const deleteBranch = new DeleteBranch({ branchRepository, notificationService, auditService });
  const suspendUser = new SuspendUser({ userRepository, notificationService, auditService });
  const getUserActiveTransactions = new GetUserActiveTransactions({ userRepository, transactionRepository });
  const resetDevData = new ResetDevData();
  const createExternalAccount = new CreateExternalAccount();
  const getExternalAccounts   = new GetExternalAccounts();
  const updateExternalAccount = new UpdateExternalAccount();
  const addExternalEntry      = new AddExternalEntry();
  const getExternalLedger     = new GetExternalLedger();
  const externalAccountController = new ExternalAccountController({ createExternalAccount, getExternalAccounts, updateExternalAccount, addExternalEntry, getExternalLedger });

  const registerAppInstall = new RegisterAppInstall();
  const requestAppAccess   = new RequestAppAccess({ notificationService });
  const approveAppAccess   = new ApproveAppAccess();
  const rejectAppAccess    = new RejectAppAccess();
  const listAppAccess      = new ListAppAccess();
  const appInstallController = new AppInstallController({ registerAppInstall, requestAppAccess, approveAppAccess, rejectAppAccess, listAppAccess });

  // Controllers
  const authController = new AuthController({ loginUseCase, refreshTokenUseCase, tenantRepository });
  const branchController = new BranchController({ createBranch, updateBranch, getBranches, branchRepository, deleteBranch, getBranchLedger, getBranchDailyBalances, notificationService, auditService });
  const userController = new UserController({ createUser, updateUser, getUsers, resetPassword, userRepository, suspendUser, getUserActiveTransactions, notificationService, auditService });
  const reportController = new ReportController({
    getReports,
    exportReport,
    getLoginReport,
    getDailyReport,
    getPendingQueue: getPendingApprovalQueue,
    getOutstandingPayments,
    getRejectedTransactions,
    getBranchCollectionReport,
    getBranchFlowMatrix,
    getDailyTally,
    getAllBranchDailyBalances,
    getCashPosition,
    getStaffReport,
    getCommissionOverrideReport,
    getPeriodComparison,
    getPaymentMethodReport,
  });
  const auditLogController = new AuditLogController({ getAuditLogs });
  const transactionController = new TransactionController({ createTransaction, approveTransaction, rejectTransaction, completePayment, getTransactions, getTransaction, transactionRepository });
  const tenantController = new TenantController({ createTenant, updateTenantStatus, updateTenantBranchLimit, updateTenantStaffLimit, getTenants, tenantRepository, branchRepository, userRepository, createUser, resetDevData });
  const dashboardController = new DashboardController({ getDashboard });
  const settingsController = new SettingsController({ getSettings, updateSettings });
  const deviceSessionController = new DeviceSessionController({ listDeviceSessions, approveDeviceSession, rejectDeviceSession, suspendDeviceSession, suspendAllSessions });

  return {
    authController,
    branchController,
    userController,
    transactionController,
    tenantController,
    dashboardController,
    settingsController,
    reportController,
    auditLogController,
    deviceSessionController,
    commissionSettlementController,
    reportRoutes,
    notificationRoutes,
    auditLogRoutes,
    deviceSessionRoutes,
    appInstallController,
    appInstallRoutes,
    commissionSettlementRoutes,
    externalAccountController,
    externalAccountRoutes,
  };
}
