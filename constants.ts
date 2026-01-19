
import { Material, Transaction, TransactionType, WorkshopCode, User, UserRole, Permission } from './types';

export const CLASSIFICATIONS = [
  'Vật tư chính',
  'Vật tư phụ'
];

export const WORKSHOPS: { code: WorkshopCode; name: string }[] = [
  { code: 'OG', name: 'Xưởng Ống gió' },
  { code: 'CK', name: 'Xưởng Cơ khí' },
  { code: 'NT', name: 'Xưởng Nội thất' }
];

export const INITIAL_MATERIALS: Material[] = [
  { id: '1', name: 'Xi măng Hà Tiên PC40', classification: 'Vật tư chính', unit: 'Bao', quantity: 150, minThreshold: 50, lastUpdated: '2024-05-15', workshop: 'OG', origin: 'Việt Nam', note: 'Vật tư nhập lô lớn' },
  { id: '2', name: 'Thép phi 10', classification: 'Vật tư chính', unit: 'Cây', quantity: 200, minThreshold: 30, lastUpdated: '2024-05-16', workshop: 'CK', origin: 'Hòa Phát' },
  { id: '3', name: 'Gỗ MDF An Cường', classification: 'Vật tư chính', unit: 'Tấm', quantity: 45, minThreshold: 10, lastUpdated: '2024-05-14', workshop: 'NT', origin: 'Việt Nam' },
  { id: '4', name: 'Bulong M10x50', classification: 'Vật tư phụ', unit: 'Cái', quantity: 500, minThreshold: 100, lastUpdated: '2024-05-17', workshop: 'CK', origin: 'Đài Loan', note: 'Dùng cho dự án PCCC' },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    receiptId: 'PNK/OG/24/48291',
    materialId: '1',
    materialName: 'Xi măng Hà Tiên PC40',
    type: TransactionType.IN,
    quantity: 100,
    date: '2024-05-15',
    user: 'ADMIN',
    workshop: 'OG'
  }
];

export const PERMISSIONS: { [key in Permission]: string } = {
  VIEW_DASHBOARD: 'Xem tổng quan',
  VIEW_INVENTORY: 'Xem kho vật tư',
  VIEW_HISTORY: 'Xem lịch sử',
  VIEW_ORDERS: 'Xem dự toán',
  MANAGE_MATERIALS: 'Quản lý vật tư',
  CREATE_RECEIPT: 'Lập phiếu',
  DELETE_TRANSACTION: 'Xóa giao dịch',
  MANAGE_BUDGETS: 'Quản lý dự toán',
  TRANSFER_MATERIALS: 'Điều chuyển vật tư',
  EXPORT_DATA: 'Xuất dữ liệu',
  MANAGE_USERS: 'Quản lý người dùng',
  VIEW_ACTIVITY_LOG: 'Xem nhật ký hoạt động',
  MANAGE_SETTINGS: 'Quản lý cài đặt'
};

export const ROLE_PERMISSIONS: { [key in UserRole]: Permission[] } = {
  ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_INVENTORY',
    'VIEW_HISTORY',
    'VIEW_ORDERS',
    'MANAGE_MATERIALS',
    'CREATE_RECEIPT',
    'DELETE_TRANSACTION',
    'MANAGE_BUDGETS',
    'TRANSFER_MATERIALS',
    'EXPORT_DATA',
    'MANAGE_USERS',
    'VIEW_ACTIVITY_LOG',
    'MANAGE_SETTINGS'
  ],
  MANAGER: [
    'VIEW_DASHBOARD',
    'VIEW_INVENTORY',
    'VIEW_HISTORY',
    'VIEW_ORDERS',
    'MANAGE_MATERIALS',
    'CREATE_RECEIPT',
    'DELETE_TRANSACTION',
    'MANAGE_BUDGETS',
    'TRANSFER_MATERIALS',
    'EXPORT_DATA',
    'VIEW_ACTIVITY_LOG'
  ],
  STAFF: [
    'VIEW_DASHBOARD',
    'VIEW_INVENTORY',
    'VIEW_HISTORY',
    'VIEW_ORDERS',
    'CREATE_RECEIPT',
    'EXPORT_DATA'
  ]
};

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    username: 'admin',
    password: '123',
    fullName: 'Quản trị viên',
    email: 'admin@smartstock.com',
    role: 'ADMIN',
    permissions: ROLE_PERMISSIONS.ADMIN,
    isActive: true,
    createdAt: '2024-01-01',
    createdBy: 'SYSTEM'
  },
  {
    id: 'u2',
    username: 'manager',
    password: '123',
    fullName: 'Quản lý kho',
    email: 'manager@smartstock.com',
    role: 'MANAGER',
    permissions: ROLE_PERMISSIONS.MANAGER,
    isActive: true,
    createdAt: '2024-01-01',
    createdBy: 'SYSTEM'
  },
  {
    id: 'u3',
    username: 'staff',
    password: '123',
    fullName: 'Nhân viên kho',
    email: 'staff@smartstock.com',
    role: 'STAFF',
    permissions: ROLE_PERMISSIONS.STAFF,
    isActive: true,
    createdAt: '2024-01-01',
    createdBy: 'SYSTEM'
  }
];
