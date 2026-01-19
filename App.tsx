
import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Plus,
  Search,
  AlertTriangle,
  X,
  Warehouse,
  FileText,
  Printer,
  Trash2,
  ClipboardList,
  Edit2,
  Check,
  RefreshCcw,
  ArrowRightLeft,
  LogOut,
  CheckCircle2,
  Minus,
  List,
  ChevronRight,
  Filter,
  ShoppingCart,
  HelpCircle,
  Download,
  FileSpreadsheet,
  Users,
  User as UserIcon,
  Settings,
  Lock,
  Activity,
  Shield,
  ListChecks,
  Save,
  AlertCircle,
  Info,
  Heart,
  Inbox,
  Moon,
  Sun
} from 'lucide-react';

import { Material, Transaction, TransactionType, WorkshopCode, OrderBudget, BudgetItem, UserRole, User, Permission, ActivityLog } from './types';
import { INITIAL_MATERIALS, INITIAL_TRANSACTIONS, CLASSIFICATIONS, WORKSHOPS, INITIAL_USERS, PERMISSIONS, ROLE_PERMISSIONS } from './constants';
import * as XLSX from 'xlsx-js-style';

import { io } from 'socket.io-client';

// Socket instance (initialized dynamically)
let socket: any;

const App: React.FC = () => {
  // --- CONNECTION CONFIG ---
  const [connectionConfig, setConnectionConfig] = useState<{ mode: 'SERVER' | 'CLIENT' | null, serverIp: string }>(() => {
    const saved = localStorage.getItem('connection_config');
    if (saved) return JSON.parse(saved);
    return { mode: null, serverIp: '' };
  });

  const [baseUrl, setBaseUrl] = useState(() => {
    // 1. If running from file system (Production Electron), ALWAYS use localhost:3000
    if (window.location.protocol === 'file:') {
      return 'http://localhost:3000';
    }

    // 2. Load saved config
    const saved = localStorage.getItem('connection_config');
    if (saved) {
      const config = JSON.parse(saved);
      if (config.mode === 'SERVER') {
        // FORCE localhost:3000 for Server Mode to avoid empty string errors
        // This addresses issues where Electron might load via http://localhost fallback or other protocols
        return 'http://localhost:3000';
      }
      return `http://${config.serverIp}:3000`;
    }

    // 3. Default fallback
    return '';
  });

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('STAFF');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rememberPassword, setRememberPassword] = useState(() => {
    return localStorage.getItem('remembered_login') !== null;
  });

  // --- DATA STATE ---
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<OrderBudget[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);

  // Helper for date formatting dd/mm/yyyy
  const formatLocalDate = (dateStr?: string | number) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // --- UI STATE ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- SYSTEM INFO ---
  const [serverIp, setServerIp] = useState<string>('');

  useEffect(() => {
    if (connectionConfig.mode === 'SERVER') {
      apiCall('/api/system-info', 'GET').then(res => res.json()).then(data => setServerIp(data.ip)).catch(() => { });
    }
  }, [connectionConfig.mode]);

  const loadData = async (isBackground = false) => {
    if (isSyncing && !isBackground) return;
    if (!isBackground) setIsSyncing(true);

    try {
      const [matRes, txRes, budgetRes, userRes, logRes] = await Promise.all([
        apiCall('/api/materials', 'GET'),
        apiCall('/api/transactions', 'GET'),
        apiCall('/api/budgets', 'GET'),
        apiCall('/api/users', 'GET'),
        apiCall('/api/activity_logs', 'GET')
      ]);

      if (matRes.ok) setMaterials(await matRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (budgetRes.ok) setBudgets(await budgetRes.json());
      if (userRes.ok) {
        const data = await userRes.json();
        setUsers(data);
        if (currentUser) {
          const updatedSelf = data.find((u: User) => u.id === currentUser.id);
          if (updatedSelf) setCurrentUser(updatedSelf);
        }
      }
      if (logRes.ok) setActivityLogs(await logRes.json());
      setLastSync(new Date());
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      if (!isBackground) setIsSyncing(false);
    }
  };

  // Helper to parse numbers from string inputs (supports comma and dot)
  const parseNumber = (val: string | number | undefined): number => {
    if (val === undefined || val === '' || val === null) return 0;
    if (typeof val === 'number') return val;
    // Replace comma with dot
    const cleanVal = val.toString().replace(/,/g, '.');
    const floatVal = parseFloat(cleanVal);
    // Return 0 if NaN, otherwise round to 2 decimals
    return isNaN(floatVal) ? 0 : Math.round(floatVal * 100) / 100;
  };

  // Helper for API calls
  const apiCall = async (endpoint: string, method: string, body?: any) => {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        try {
          const errorText = await res.clone().text();
          console.error(`API Error ${baseUrl}${endpoint}: ${res.status}`, errorText);
        } catch (e) {
          console.error(`API Error ${baseUrl}${endpoint}: ${res.status} (body unreadable)`);
        }
      }
      return res;
    } catch (e) {
      console.error(`API Network Error ${baseUrl}${endpoint}:`, e);
      alert(`Lỗi kết nối đến máy chủ (${baseUrl}): Vui lòng kiểm tra lại địa chỉ IP.`);
      throw e;
    }
  };

  const [tempIp, setTempIp] = useState('');

  const handleSaveConnection = (mode: 'SERVER' | 'CLIENT', ip?: string) => {
    const config = { mode, serverIp: ip || '' };
    localStorage.setItem('connection_config', JSON.stringify(config));

    // Determine base URL based on environment and mode
    let newUrl = '';
    if (mode === 'SERVER') {
      // FORCE localhost:3000 for Server Mode
      newUrl = 'http://localhost:3000';
    } else {
      newUrl = `http://${ip}:3000`;
    }

    setConnectionConfig(config);
    setBaseUrl(newUrl);
    window.location.reload();
  };

  useEffect(() => {
    if (!connectionConfig.mode) return;

    // Initialize socket with correct URL
    if (socket) socket.disconnect();
    socket = io(baseUrl || window.location.origin);

    loadData();
    // Load remembered login
    const saved = localStorage.getItem('remembered_login');
    if (saved) {
      try {
        const { username, password } = JSON.parse(saved);
        setLoginForm({ username, password });
        setRememberPassword(true);
      } catch (e) {
        localStorage.removeItem('remembered_login');
      }
    }
    // Poll every 10 seconds to keep data synced
    const interval = setInterval(loadData, 10000);

    // Socket.io for Real-time sync
    socket.on('data_updated', loadData);

    return () => {
      clearInterval(interval);
      if (socket) socket.off('data_updated', loadData);
    };
  }, [connectionConfig.mode, baseUrl]);


  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'history' | 'users' | 'activity' | 'account' | 'credits'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryWorkshopFilter, setInventoryWorkshopFilter] = useState<WorkshopCode | 'ALL'>('ALL');
  const [inventoryClassFilter, setInventoryClassFilter] = useState<'ALL' | 'Vật tư chính' | 'Vật tư phụ'>('ALL');

  // --- MODALS STATE ---
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; type: 'danger' | 'info'; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info', onConfirm: () => { } });

  // --- FORM STATES ---
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [materialForm, setMaterialForm] = useState<Partial<Material>>({
    name: '', classification: 'Vật tư phụ', unit: '', quantity: 0, minThreshold: 0, workshop: 'OG', origin: '', note: ''
  });

  const [receiptType, setReceiptType] = useState<TransactionType>(TransactionType.OUT);
  const [receiptWorkshop, setReceiptWorkshop] = useState<WorkshopCode>('OG');
  const [receiptSearchWorkshop, setReceiptSearchWorkshop] = useState<WorkshopCode | 'ALL'>('ALL');
  const [receiptSearchClass, setReceiptSearchClass] = useState<'ALL' | 'Vật tư chính' | 'Vật tư phụ'>('ALL');
  const [orderCode, setOrderCode] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ materialId: string, quantity: number }[]>([]);
  const [materialSearch, setMaterialSearch] = useState('');

  const [transferForm, setTransferForm] = useState({
    items: [] as { materialId: string, quantity: number }[],
    fromWorkshop: 'OG' as WorkshopCode,
    toWorkshop: 'CK' as WorkshopCode,
    orderCode: '',
    receiptId: '',
    search: ''
  });

  const [editingBudget, setEditingBudget] = useState<OrderBudget | null>(null);
  const [budgetForm, setBudgetForm] = useState<{ orderCode: string; workshop: WorkshopCode; items: BudgetItem[] }>({
    orderCode: '', workshop: 'OG', items: []
  });

  const [historyFilter, setHistoryFilter] = useState({
    type: 'ALL', workshop: 'ALL', startDate: '', endDate: '', orderCode: ''
  });
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopCode>('OG');
  const [ordersWorkshopFilter, setOrdersWorkshopFilter] = useState<WorkshopCode | 'ALL'>('ALL');

  // --- USER MANAGEMENT FORM STATE ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<Partial<User>>({
    username: '', password: '', fullName: '', email: '', role: 'STAFF', permissions: [], isActive: true
  });

  const [accountForm, setAccountForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '', fullName: '', email: ''
  });

  const [activityFilter, setActivityFilter] = useState({
    userId: 'ALL', entityType: 'ALL', startDate: '', endDate: ''
  });

  // Tự động tạo mã phiếu khi modal mở hoặc khi receiptType/receiptWorkshop thay đổi
  useEffect(() => {
    if (isReceiptModalOpen) {
      setReceiptId(generateReceiptId(receiptType, receiptWorkshop));
    }
    if (isTransferModalOpen) {
      setTransferForm(prev => ({ ...prev, receiptId: generateReceiptId(TransactionType.TRANSFER, prev.fromWorkshop) }));
    }
  }, [isReceiptModalOpen, isTransferModalOpen, receiptType, receiptWorkshop]);

  // --- LOGIC ---

  // Hàm tính toán mã phiếu tự động dựa trên dữ liệu hiện có
  const generateReceiptId = (type: TransactionType, workshop: WorkshopCode) => {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = type === TransactionType.IN ? 'PNK' : type === TransactionType.OUT ? 'PXK' : 'PDC';

    // Tìm các giao dịch cùng loại, xưởng và năm hiện tại
    const sameTypeTxs = transactions.filter(t =>
      t.receiptId.startsWith(`${prefix}/${workshop}/${year}/`)
    );

    let nextNum = 1;
    if (sameTypeTxs.length > 0) {
      // Trích xuất phần số từ mã phiếu (index 3 sau khi split '/')
      const nums = sameTypeTxs.map(t => {
        const parts = t.receiptId.split('/');
        return parseInt(parts[3], 10) || 0;
      });
      nextNum = Math.max(...nums) + 1;
    }

    const paddedCount = nextNum.toString().padStart(5, '0');
    return `${prefix}/${workshop}/${year}/${paddedCount}`;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginForm.username.trim().toLowerCase();
    const p = loginForm.password.trim();

    const foundUser = users.find(user =>
      user.username.toLowerCase() === u &&
      user.password === p &&
      user.isActive
    );

    if (foundUser) {
      setCurrentUser(foundUser);
      setUserRole(foundUser.role);
      setIsAuthenticated(true);

      // Save login info if remember password is checked
      if (rememberPassword) {
        localStorage.setItem('remembered_login', JSON.stringify({ username: u, password: p }));
      } else {
        localStorage.removeItem('remembered_login');
      }

      // Update last login
      setUsers(prev => prev.map(user =>
        user.id === foundUser.id
          ? { ...user, lastLogin: new Date().toISOString() }
          : user
      ));

      // Log activity
      const loginLog: ActivityLog = {
        id: `log-${Date.now()}`,
        userId: foundUser.id,
        username: foundUser.username,
        action: 'Đăng nhập hệ thống',
        entityType: 'SYSTEM',
        details: `Đăng nhập thành công`,
        timestamp: new Date().toISOString()
      };
      setActivityLogs(prev => [loginLog, ...prev]);
      apiCall('/api/activity_logs/save', 'POST', loginLog);
      setLoginError(null);
    } else {
      setLoginError('Thông tin đăng nhập không chính xác hoặc tài khoản đã bị vô hiệu hóa');
      // Tự động xóa lỗi sau 3 giây
      setTimeout(() => setLoginError(null), 3000);
    }
  };

  const handleLogout = () => {
    logActivity('Đăng xuất khỏi hệ thống', 'SYSTEM', undefined, 'Đăng xuất');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Helper function to log activities
  const logActivity = (action: string, entityType: ActivityLog['entityType'], entityId?: string, details?: string) => {
    if (!currentUser) return;
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      action,
      entityType,
      entityId,
      details: details || action,
      timestamp: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev]);
    apiCall('/api/activity_logs/save', 'POST', newLog);
  };

  // Helper function to check permissions
  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    return currentUser.permissions.includes(permission) || currentUser.role === 'ADMIN';
  };

  const canModify = hasPermission('MANAGE_MATERIALS');
  const isStaff = userRole === 'STAFF';

  const summary = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t => t.date === today);
    const todayIn = todayTransactions.filter(t => t.type === TransactionType.IN).reduce((sum, t) => sum + t.quantity, 0);
    const todayOut = todayTransactions.filter(t => t.type === TransactionType.OUT).reduce((sum, t) => sum + t.quantity, 0);

    // Dữ liệu cho biểu đồ xưởng
    const workshopData = WORKSHOPS.map(w => ({
      name: w.code,
      total: materials.filter(m => m.workshop === w.code).length,
      quantity: materials.filter(m => m.workshop === w.code).reduce((sum, m) => sum + m.quantity, 0)
    }));

    // Dữ liệu cho biểu đồ hoạt động (7 ngày gần nhất)
    const activityData = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const txs = transactions.filter(t => t.date === dateStr);
      return {
        name: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        nhập: txs.filter(t => t.type === TransactionType.IN).length,
        xuất: txs.filter(t => t.type === TransactionType.OUT).length
      };
    });

    return {
      totalItems: materials.length,
      lowStockItems: materials.filter(m => m.quantity <= m.minThreshold),
      lowStockCount: materials.filter(m => m.quantity <= m.minThreshold).length,
      mainItems: materials.filter(m => m.classification === 'Vật tư chính').length,
      txCount: transactions.length,
      todayIn,
      todayOut,
      workshopData,
      activityData
    };
  }, [materials, transactions]);

  const filteredMaterials = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return materials.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(term) || m.id.toLowerCase().includes(term) || m.origin.toLowerCase().includes(term);
      const matchWorkshop = inventoryWorkshopFilter === 'ALL' || m.workshop === inventoryWorkshopFilter;
      const matchClass = inventoryClassFilter === 'ALL' || m.classification === inventoryClassFilter;
      return matchSearch && matchWorkshop && matchClass;
    });
  }, [materials, searchTerm, inventoryWorkshopFilter, inventoryClassFilter]);

  const filteredTransactions = useMemo(() => {
    const sTerm = historySearchTerm.toLowerCase();
    return transactions.filter(t => {
      const matchType = historyFilter.type === 'ALL' || t.type === historyFilter.type;
      const matchWorkshop = historyFilter.workshop === 'ALL' || t.workshop === historyFilter.workshop;
      const matchStart = !historyFilter.startDate || t.date >= historyFilter.startDate;
      const matchEnd = !historyFilter.endDate || t.date <= historyFilter.endDate;
      const matchOrder = !historyFilter.orderCode || (t.orderCode || '').toLowerCase().includes(historyFilter.orderCode.toLowerCase());
      const matchSearch = !sTerm ||
        t.materialName.toLowerCase().includes(sTerm) ||
        t.receiptId.toLowerCase().includes(sTerm) ||
        (t.orderCode || '').toLowerCase().includes(sTerm);

      return matchType && matchWorkshop && matchStart && matchEnd && matchOrder && matchSearch;
    });
  }, [transactions, historyFilter, historySearchTerm]);

  // Hàm tạo mã vật tư tự động theo định dạng VT/Xưởng/00001
  const generateMaterialId = (workshop: WorkshopCode) => {
    const sameWorkshopMaterials = materials.filter(m => m.workshop === workshop && m.id.startsWith(`VT/${workshop}/`));
    let nextNum = 1;
    if (sameWorkshopMaterials.length > 0) {
      const nums = sameWorkshopMaterials.map(m => {
        const parts = m.id.split('/');
        return parseInt(parts[2], 10) || 0;
      });
      nextNum = Math.max(...nums) + 1;
    }
    const paddedCount = nextNum.toString().padStart(5, '0');
    return `VT/${workshop}/${paddedCount}`;
  };

  const requestConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'info' = 'info') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, type });
  };

  const handleSaveMaterial = () => {
    if (!materialForm.name || !materialForm.unit) {
      alert('Vui lòng điền đầy đủ Tên vật tư và Đơn vị tính.'); return;
    }

    if (editingMaterial) {
      const updated = { ...editingMaterial, ...materialForm, lastUpdated: new Date().toISOString().split('T')[0] } as Material;
      setMaterials(prev => prev.map(m => m.id === editingMaterial.id ? updated : m));
      apiCall('/api/materials/save', 'POST', updated);
    } else {
      const newMat: Material = {
        ...materialForm as Material,
        id: generateMaterialId(materialForm.workshop as WorkshopCode || 'OG'),
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      setMaterials(prev => [...prev, newMat]);
      apiCall('/api/materials/save', 'POST', newMat);
    }
    setIsMaterialModalOpen(false);
    setEditingMaterial(null);
  };

  const handleDeleteMaterial = (id: string) => {
    requestConfirm('Xóa vật tư', 'Bạn có chắc chắn muốn xóa vật tư này khỏi hệ thống? Dữ liệu này không thể khôi phục.', () => {
      setMaterials(prev => prev.filter(m => m.id !== id));
      apiCall('/api/materials/delete', 'POST', { id });
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }, 'danger');
  };

  const quickRestock = (material: Material) => {
    setReceiptType(TransactionType.IN);
    setReceiptWorkshop(material.workshop);
    setSelectedItems([{ materialId: material.id, quantity: material.minThreshold * 2 }]);
    setIsReceiptModalOpen(true);
  };

  const handleCreateReceipt = () => {
    if (selectedItems.length === 0) return;

    if (receiptType === TransactionType.OUT && orderCode) {
      const budget = budgets.find(b => b.orderCode === orderCode);
      if (budget) {
        let violations: string[] = [];
        for (const item of selectedItems) {
          const originalMat = materials.find(m => m.id === item.materialId);
          const budgetItem = budget.items.find(bi => bi.materialName === originalMat?.name);

          if (budgetItem) {
            const alreadyIssued = transactions
              .filter(t => t.type === TransactionType.OUT && t.orderCode === orderCode && t.materialName === originalMat?.name)
              .reduce((sum, t) => sum + t.quantity, 0);

            if (alreadyIssued + item.quantity > budgetItem.estimatedQty) {
              violations.push(`${originalMat?.name} (${alreadyIssued + item.quantity}/${budgetItem.estimatedQty})`);
            }
          } else {
            violations.push(`${originalMat?.name} (Không có trong dự toán đơn ${orderCode})`);
          }
        }

        if (violations.length > 0) {
          setModalError(`⚠ Cảnh báo vượt dự toán: ${violations.join(', ')}. Vui lòng kiểm tra lại.`);
          return;
        }
      }
    }

    requestConfirm('Xác nhận lập phiếu', `Hệ thống sẽ ${receiptType === 'IN' ? 'Nhập' : 'Xuất'} hàng vào kho ${receiptWorkshop}.`, async () => {
      const finalReceiptId = receiptId.trim() || generateReceiptId(receiptType, receiptWorkshop);
      const newTxs: Transaction[] = [];
      let currentMaterials = [...materials];
      const timestamp = Date.now();

      for (const item of selectedItems) {
        const sourceMat = currentMaterials.find(m => m.id === item.materialId);
        if (!sourceMat) continue;

        let idx = currentMaterials.findIndex(m => m.name === sourceMat.name && m.origin === sourceMat.origin && m.workshop === receiptWorkshop);

        if (idx === -1 && receiptType === TransactionType.IN) {
          const newMat: Material = {
            ...sourceMat,
            id: generateMaterialId(receiptWorkshop),
            workshop: receiptWorkshop,
            quantity: 0,
            lastUpdated: formatLocalDate()
          };
          currentMaterials.push(newMat);
          idx = currentMaterials.length - 1;
        }

        if (idx > -1) {
          const mat = currentMaterials[idx];
          if (receiptType === TransactionType.OUT && mat.quantity < item.quantity) {
            setModalError(`Lỗi: ${mat.name} không đủ tồn kho tại ${receiptWorkshop}.`); return;
          }
          const change = receiptType === TransactionType.IN ? item.quantity : -item.quantity;
          const updatedMat = { ...mat, quantity: Math.round((mat.quantity + change) * 100) / 100, lastUpdated: new Date().toISOString().split('T')[0] };
          currentMaterials = currentMaterials.map((m, i) => i === idx ? updatedMat : m);

          newTxs.push({
            id: `t-${timestamp}-${Math.random().toString(36).substr(2, 5)}`,
            receiptId: finalReceiptId,
            materialId: updatedMat.id,
            materialName: updatedMat.name,
            type: receiptType,
            quantity: item.quantity,
            date: formatLocalDate(),
            user: currentUser?.fullName || userRole,
            workshop: receiptWorkshop,
            orderCode: orderCode || undefined
          });
        } else if (receiptType === TransactionType.OUT) {
          setModalError(`Lỗi: Vật tư ${sourceMat.name} chưa có tại xưởng ${receiptWorkshop}.`); return;
        }
      }

      setMaterials(currentMaterials);
      setTransactions(prev => [...newTxs, ...prev]);

      try {
        // Lưu vật tư đã thay đổi
        const matToUpdate = currentMaterials.filter(m =>
          selectedItems.some(si => si.materialId === m.id) ||
          newTxs.some(tx => tx.materialId === m.id)
        );
        for (const m of matToUpdate) {
          await apiCall('/api/materials/save', 'POST', m);
        }
        // Lưu lịch sử giao dịch
        for (const t of newTxs) {
          const res = await apiCall('/api/transactions/save', 'POST', t);
          if (!res.ok) {
            const errorTxt = await res.text();
            setModalError(`Lỗi khi lưu giao dịch: ${errorTxt}`);
            console.error("Lỗi khi lưu giao dịch vào DB:", t, errorTxt);
          }
        }
        logActivity(`Lập phiếu ${receiptType === 'IN' ? 'Nhập' : 'Xuất'} ${finalReceiptId}`, 'TRANSACTION', finalReceiptId);
      } catch (err) {
        console.error("Lỗi đồng bộ backend:", err);
      }

      setIsReceiptModalOpen(false);
      setModalError(null);
      setSelectedItems([]);
      setOrderCode('');
      setReceiptId('');
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    });
  };

  const handleTransfer = () => {
    const { items, fromWorkshop, toWorkshop, orderCode, receiptId } = transferForm;
    if (items.length === 0 || fromWorkshop === toWorkshop) {
      setModalError('Vui lòng chọn vật tư và kho đích khác kho nguồn.'); return;
    }

    requestConfirm('Xác nhận điều chuyển', `Chuyển ${items.length} loại vật tư từ ${fromWorkshop} sang ${toWorkshop}?`, async () => {
      let updatedMaterials = [...materials];
      const newTxs: Transaction[] = [];
      const timestamp = Date.now();
      const finalReceiptId = receiptId.trim() || generateReceiptId(TransactionType.TRANSFER, fromWorkshop);

      for (const item of items) {
        const sMat = updatedMaterials.find(m => m.id === item.materialId && m.workshop === fromWorkshop);
        if (!sMat || sMat.quantity < item.quantity) {
          setModalError(`Lỗi: ${sMat?.name || 'Vật tư'} không đủ tồn tại ${fromWorkshop}.`); return;
        }

        // 1. Giảm ở kho nguồn
        updatedMaterials = updatedMaterials.map(m =>
          (m.id === item.materialId && m.workshop === fromWorkshop)
            ? { ...m, quantity: Math.round((m.quantity - item.quantity) * 100) / 100, lastUpdated: new Date().toISOString().split('T')[0] }
            : m
        );

        // 2. Tăng ở kho đích
        const tIdx = updatedMaterials.findIndex(m => m.name === sMat.name && m.origin === sMat.origin && m.workshop === toWorkshop);
        let targetMatId = '';
        if (tIdx > -1) {
          const tMat = updatedMaterials[tIdx];
          updatedMaterials = updatedMaterials.map((m, i) => i === tIdx ? { ...m, quantity: Math.round((m.quantity + item.quantity) * 100) / 100, lastUpdated: new Date().toISOString().split('T')[0] } : m);
          targetMatId = tMat.id;
        } else {
          const newId = generateMaterialId(toWorkshop);
          const newMat: Material = {
            ...sMat,
            id: newId,
            workshop: toWorkshop,
            quantity: item.quantity,
            lastUpdated: new Date().toISOString().split('T')[0]
          };
          updatedMaterials = [...updatedMaterials, newMat];
          targetMatId = newId;
        }

        // 3. Tạo Transaction
        newTxs.push({
          id: `tr-${timestamp}-${Math.random().toString(36).substr(2, 5)}`,
          receiptId: finalReceiptId,
          materialId: item.materialId,
          materialName: sMat.name,
          type: TransactionType.TRANSFER,
          quantity: item.quantity,
          date: formatLocalDate(),
          user: currentUser?.fullName || userRole,
          workshop: fromWorkshop,
          targetWorkshop: toWorkshop,
          orderCode: orderCode || undefined
        });
      }

      setMaterials(updatedMaterials);
      setTransactions(prev => [...newTxs, ...prev]);

      try {
        // Đồng bộ backend
        for (const tx of newTxs) {
          const sM = updatedMaterials.find(m => m.name === tx.materialName && m.workshop === fromWorkshop);
          const dM = updatedMaterials.find(m => m.name === tx.materialName && m.workshop === toWorkshop);
          if (sM) await apiCall('/api/materials/save', 'POST', sM);
          if (dM) await apiCall('/api/materials/save', 'POST', dM);

          const res = await apiCall('/api/transactions/save', 'POST', tx);
          if (!res.ok) {
            const errorTxt = await res.text();
            setModalError(`Lỗi khi lưu giao dịch điều chuyển: ${errorTxt}`);
          }
        }

        logActivity(`Điều chuyển ${items.length} loại vật tư từ ${fromWorkshop} sang ${toWorkshop}`, 'TRANSACTION', finalReceiptId);
      } catch (err) {
        console.error("Lỗi đồng bộ điều chuyển:", err);
      }

      setIsTransferModalOpen(false);
      setModalError(null);
      setTransferForm(prev => ({ ...prev, items: [], orderCode: '', receiptId: '' }));
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    });
  };

  const handleDeleteTransaction = (tx: Transaction) => {
    requestConfirm(
      'Xóa phiếu giao dịch',
      `Bạn có chắc chắn muốn xóa phiếu ${tx.receiptId}? Tồn kho sẽ được hoàn tác tự động.`,
      () => {
        let updatedMaterials = [...materials];

        if (tx.type === TransactionType.IN) {
          updatedMaterials = updatedMaterials.map(m =>
            m.id === tx.materialId ? { ...m, quantity: m.quantity - tx.quantity } : m
          );
        } else if (tx.type === TransactionType.OUT) {
          updatedMaterials = updatedMaterials.map(m =>
            m.id === tx.materialId ? { ...m, quantity: m.quantity + tx.quantity } : m
          );
        } else if (tx.type === TransactionType.TRANSFER) {
          updatedMaterials = updatedMaterials.map(m =>
            (m.name === tx.materialName && m.workshop === tx.workshop) ? { ...m, quantity: m.quantity + tx.quantity } : m
          );
          if (tx.targetWorkshop) {
            updatedMaterials = updatedMaterials.map(m =>
              (m.name === tx.materialName && m.workshop === tx.targetWorkshop) ? { ...m, quantity: m.quantity - tx.quantity } : m
            );
          }
        }

        setMaterials(updatedMaterials);
        setTransactions(prev => prev.filter(t => t.id !== tx.id));

        // Update backend
        updatedMaterials.forEach(m => apiCall('/api/materials/save', 'POST', m));
        apiCall('/api/transactions/delete', 'POST', { id: tx.id });

        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
      'danger'
    );
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws_data: any[][] = [];

    // Cấu hình style chung
    const headerStyle = {
      fill: { fgColor: { rgb: "D9EAD3" } }, // Màu xanh nhạt
      font: { bold: true, sz: 14, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" }
      }
    };

    const cellStyle = {
      font: { sz: 14 },
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" }
      }
    };

    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: "20124D" } },
      alignment: { horizontal: "center" }
    };

    // Tiêu đề đơn hàng
    ws_data.push([{ v: "BÁO CÁO LỊCH SỬ GIAO DỊCH VẬT TƯ", t: "s", s: titleStyle }]);
    ws_data.push([{ v: `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, t: "s", s: { alignment: { horizontal: "center" }, font: { sz: 14 } } }]);
    ws_data.push([]); // Dòng trống

    // Nhóm giao dịch theo receiptId
    const groupedByReceipt: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach(t => {
      if (!groupedByReceipt[t.receiptId]) groupedByReceipt[t.receiptId] = [];
      groupedByReceipt[t.receiptId].push(t);
    });

    Object.keys(groupedByReceipt).forEach(receiptId => {
      const txs = groupedByReceipt[receiptId];
      if (txs.length === 0) return;

      const firstTx = txs[0];
      ws_data.push([{ v: `MÃ PHIẾU: ${receiptId}`, t: "s", s: { font: { bold: true, sz: 14 } } }]);
      ws_data.push([{ v: `Ngày: ${firstTx.date} | Xưởng: ${firstTx.workshop} | Loại: ${firstTx.type === 'IN' ? 'Nhập' : firstTx.type === 'OUT' ? 'Xuất' : 'Điều chuyển'}`, t: "s", s: { font: { sz: 14 } } }]);

      // Header bảng
      ws_data.push([
        { v: "Mã Vật Tư", t: "s", s: headerStyle },
        { v: "Tên Vật Tư", t: "s", s: headerStyle },
        { v: "Số lượng", t: "s", s: headerStyle },
        { v: "Đơn vị", t: "s", s: headerStyle },
        { v: "Mã Đơn Hàng", t: "s", s: headerStyle }
      ]);

      // Body bảng
      txs.forEach(t => {
        const material = materials.find(m => m.id === t.materialId);
        ws_data.push([
          { v: t.materialId, t: "s", s: cellStyle },
          { v: t.materialName, t: "s", s: cellStyle },
          { v: t.quantity, t: "n", s: { ...cellStyle, alignment: { horizontal: "center" } } },
          { v: material?.unit || "", t: "s", s: { ...cellStyle, alignment: { horizontal: "center" } } },
          { v: t.orderCode || "", t: "s", s: cellStyle }
        ]);
      });
      ws_data.push([]); // Dòng trống ngăn cách
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Merge tiêu đề chính
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 4 } });

    // Độ rộng cột (tăng thêm do font chữ lớn hơn)
    ws['!cols'] = [{ wch: 20 }, { wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];

    XLSX.utils.book_append_sheet(wb, ws, "Lịch sử GD");
    XLSX.writeFile(wb, `LichSu_GD_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportInventoryExcel = () => {
    const wb = XLSX.utils.book_new();

    // Header sytled
    const headerStyle = {
      fill: { fgColor: { rgb: "C9DAF8" } }, // Xanh dương nhạt
      font: { bold: true, sz: 14, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" }
      }
    };

    const cellStyle = {
      font: { sz: 14 },
      border: {
        top: { style: "thin" }, bottom: { style: "thin" },
        left: { style: "thin" }, right: { style: "thin" }
      },
      alignment: { vertical: "center" }
    };

    const headers = ["ID", "Tên vật tư", "Loại", "Xưởng", "Số lượng", "Định mức", "Đơn vị", "Xuất xứ", "Ngày cập nhật"].map(h => ({
      v: h, t: "s", s: headerStyle
    }));

    const rows = filteredMaterials.map(m => [
      { v: m.id, t: "s", s: cellStyle },
      { v: m.name, t: "s", s: cellStyle },
      { v: m.classification, t: "s", s: cellStyle },
      { v: m.workshop, t: "s", s: { ...cellStyle, alignment: { horizontal: "center" } } },
      { v: m.quantity, t: "n", s: { ...cellStyle, alignment: { horizontal: "right" }, font: { bold: true, sz: 14 } } },
      { v: m.minThreshold, t: "n", s: { ...cellStyle, alignment: { horizontal: "right" } } },
      { v: m.unit, t: "s", s: { ...cellStyle, alignment: { horizontal: "center" } } },
      { v: m.origin, t: "s", s: cellStyle },
      { v: m.lastUpdated, t: "s", s: cellStyle }
    ]);

    const ws_data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Độ rộng cột (tăng thêm do font chữ lớn hơn)
    ws['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }];

    XLSX.utils.book_append_sheet(wb, ws, "Tồn kho");
    XLSX.writeFile(wb, `TonKho_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const triggerActualPrint = () => {
    setIsPrintConfirmOpen(false);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleDeleteBudget = (id: string) => {
    requestConfirm('Xóa dự toán', 'Bạn có chắc chắn muốn xóa dự toán này khỏi hệ thống?', () => {
      setBudgets(prev => prev.filter(b => b.id !== id));
      apiCall('/api/budgets/delete', 'POST', { id });
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }, 'danger');
  };

  const printCurrentVoucher = () => {
    window.print();
  };

  const addBudgetItem = (m: Material) => {
    if (budgetForm.items.find(it => it.materialId === m.id)) return;
    const newItem: BudgetItem = {
      materialId: m.id,
      materialName: m.name,
      estimatedQty: 1
    };
    setBudgetForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleSaveBudget = () => {
    if (!budgetForm.orderCode) {
      alert('Vui lòng nhập mã đơn hàng.');
      return;
    }

    if (editingBudget) {
      const updated = {
        ...editingBudget,
        orderCode: budgetForm.orderCode,
        workshop: budgetForm.workshop,
        items: budgetForm.items,
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      setBudgets(prev => prev.map(b => b.id === editingBudget.id ? updated : b));
      apiCall('/api/budgets/save', 'POST', updated);
      logActivity(`Cập nhật dự toán ${budgetForm.orderCode}`, 'BUDGET', editingBudget.id);
    } else {
      const newBudget: OrderBudget = {
        id: `DT${Date.now().toString().slice(-6)}`,
        orderCode: budgetForm.orderCode,
        workshop: budgetForm.workshop,
        items: budgetForm.items,
        createdAt: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString().split('T')[0]
      };
      setBudgets(prev => [...prev, newBudget]);
      apiCall('/api/budgets/save', 'POST', newBudget);
      logActivity(`Tạo dự toán ${budgetForm.orderCode}`, 'BUDGET', newBudget.id);
    }
    setIsBudgetModalOpen(false);
    setEditingBudget(null);
  };

  // --- USER MANAGEMENT HANDLERS ---
  const handleSaveUser = () => {
    const { username, password, fullName, role } = userForm;
    if (!username || !fullName || (!editingUser && !password)) {
      alert('Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return;
    }


    if (editingUser) {
      const updated = {
        ...editingUser,
        ...userForm,
        password: userForm.password || editingUser.password
      } as User;

      setUsers(prev => prev.map(u => u.id === editingUser.id ? updated : u));
      apiCall('/api/users/save', 'POST', updated);

      logActivity(`Cập nhật người dùng ${username}`, 'USER', updated.id);
      // Also log to API? Yes, logActivity logic will be updated or assume inline calls.
      // Wait, logActivity in App.tsx just sets State. I need to update logActivity function itself to save to API.
    } else {
      const newUser: User = {
        id: `U${Date.now().toString().slice(-6)}`,
        username: username!,
        password: password!,
        fullName: fullName!,
        email: userForm.email,
        role: role as UserRole,
        permissions: userForm.permissions as Permission[] || ROLE_PERMISSIONS[role as UserRole],
        isActive: userForm.isActive !== false,
        createdAt: new Date().toISOString().split('T')[0],
        createdBy: currentUser?.id
      };
      setUsers(prev => [...prev, newUser]);
      apiCall('/api/users/save', 'POST', newUser);
      logActivity(`Tạo người dùng mới ${username}`, 'USER', newUser.id);
    }
    setIsUserModalOpen(false);
    setEditingUser(null);
    setUserForm({ username: '', password: '', fullName: '', email: '', role: 'STAFF', permissions: [], isActive: true });
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.id === currentUser?.id) {
      alert('Bạn không thể xóa chính mình.');
      return;
    }
    requestConfirm('Xóa người dùng', `Bạn có chắc chắn muốn xóa người dùng ${user?.username}?`, () => {
      setUsers(prev => prev.filter(u => u.id !== userId));
      apiCall('/api/users/delete', 'POST', { id: userId });
      logActivity(`Xóa người dùng ${user?.username}`, 'USER', userId);
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }, 'danger');
  };

  const handleDeleteLog = (id: string) => {
    requestConfirm('Xóa nhật ký', 'Bạn có chắc chắn muốn xóa mục nhật ký này?', () => {
      setActivityLogs(prev => prev.filter(log => log.id !== id));
      apiCall('/api/activity_logs/delete', 'POST', { id });
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }, 'danger');
  };

  const handleClearLogs = () => {
    requestConfirm('Xóa tất cả nhật ký', 'Bạn có chắc chắn muốn xóa TOÀN BỘ nhật ký hoạt động? Hành động này không thể khôi phục.', () => {
      setActivityLogs([]);
      apiCall('/api/activity_logs/clear', 'POST', {});
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }, 'danger');
  };

  const handleToggleUserStatus = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.id === currentUser?.id) {
      alert('Bạn không thể vô hiệu hóa chính mình.');
      return;
    }
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        logActivity(`${u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'} người dùng ${u.username}`, 'USER', u.id);
        const updated = { ...u, isActive: !u.isActive };
        apiCall('/api/users/save', 'POST', updated);
        return updated;
      }
      return u;
    }));
  };

  const handleUpdateAccount = () => {
    if (!accountForm.currentPassword) {
      alert('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (accountForm.currentPassword !== currentUser?.password) {
      alert('Mật khẩu hiện tại không chính xác.');
      return;
    }

    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
      alert('Mật khẩu mới và xác nhận không khớp.');
      return;
    }

    setUsers(prev => prev.map(u => {
      if (u.id === currentUser?.id) {
        const updated = {
          ...u,
          fullName: accountForm.fullName || u.fullName,
          email: accountForm.email || u.email,
          password: accountForm.newPassword || u.password
        } as User;
        setCurrentUser(updated);
        apiCall('/api/users/save', 'POST', updated);
        logActivity('Cập nhật thông tin tài khoản', 'USER', updated.id);
        return updated;
      }
      return u;
    }));

    setIsAccountModalOpen(false);
    setAccountForm({ currentPassword: '', newPassword: '', confirmPassword: '', fullName: currentUser?.fullName || '', email: currentUser?.email || '' });
    alert('Cập nhật thông tin thành công!');
  };

  const handleBackup = async () => {
    try {
      const res = await apiCall('/api/backup', 'POST');
      if (res.ok) {
        const data = await res.json();
        alert(`Đã sao lưu dữ liệu thành công ra Desktop!\nFile: ${data.path}`);
      } else {
        alert('Lỗi khi sao lưu dữ liệu.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredActivityLogs = useMemo(() => {
    return activityLogs.filter(log => {
      const matchUser = activityFilter.userId === 'ALL' || log.userId === activityFilter.userId;
      const matchType = activityFilter.entityType === 'ALL' || log.entityType === activityFilter.entityType;
      const matchStart = !activityFilter.startDate || log.timestamp >= activityFilter.startDate;
      const matchEnd = !activityFilter.endDate || log.timestamp <= activityFilter.endDate;
      return matchUser && matchType && matchStart && matchEnd;
    });
  }, [activityLogs, activityFilter]);

  // --- RENDER CONNECTION SETUP ---
  if (!connectionConfig.mode) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-6 font-inter">
        <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl p-12 text-center">
          <div className="inline-flex p-5 text-white bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-500/30 mb-8"><Warehouse size={64} /></div>
          <h2 className="text-4xl font-extrabold text-slate-800 tracking-tighter italic uppercase mb-2">SMART<span className="text-blue-600">STOCK</span></h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-12">Thiết lập kết nối ban đầu</p>

          <div className="grid grid-cols-2 gap-8">
            <button
              onClick={() => handleSaveConnection('SERVER')}
              className="p-8 border-2 border-slate-100 rounded-[2.5rem] hover:border-blue-500 hover:bg-blue-50 transition-all group flex flex-col items-center gap-4"
            >
              <div className="p-4 bg-slate-100 group-hover:bg-blue-100 text-slate-400 group-hover:text-blue-600 rounded-2xl transition-colors">
                <Settings size={40} />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-extrabold text-slate-800 uppercase">Máy Chủ (Server)</h3>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Dùng cho máy chính nắm giữ dữ liệu</p>
              </div>
            </button>

            <div className="p-8 border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center gap-4">
              <div className="p-4 bg-slate-100 text-slate-400 rounded-2xl">
                <ArrowRightLeft size={40} />
              </div>
              <div className="text-left w-full">
                <h3 className="text-xl font-extrabold text-slate-800 uppercase">Máy Khách (Client)</h3>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase mb-4">Kết nối vào máy chủ khác</p>
                <input
                  type="text"
                  placeholder="Nhập IP Máy Chủ (VD: 192.168.1.10)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all text-center"
                  value={tempIp}
                  onChange={e => setTempIp(e.target.value)}
                />
                <button
                  onClick={() => tempIp && handleSaveConnection('CLIENT', tempIp)}
                  disabled={!tempIp}
                  className="w-full mt-3 py-3 bg-blue-600 text-white rounded-xl font-extrabold uppercase text-[10px] tracking-widest hover:bg-blue-700 disabled:bg-slate-200 transition-all shadow-lg shadow-blue-500/20"
                >
                  Kết nối ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#0f172a] p-6 font-inter transition-colors duration-300">
        <div className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-[3rem] shadow-2xl p-12 border border-white/20 dark:border-slate-700">
          <div className="text-center mb-12">
            <div className="inline-flex p-5 text-white bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-500/30 mb-6"><Warehouse size={40} /></div>
            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tighter italic uppercase">SMART<span className="text-blue-600 dark:text-blue-400">STOCK</span></h2>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mt-3">Hệ thống quản lý kho v3.7</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase ml-1">Tên đăng nhập</label>
              <input type="text" autoComplete="off" className="w-full p-5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:border-blue-600 transition-all input-focus" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase ml-1">Mật khẩu</label>
              <input type="password" autoComplete="new-password" className="w-full p-5 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-2xl font-bold dark:text-white outline-none focus:border-blue-600 transition-all input-focus" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="remember" checked={rememberPassword} onChange={e => setRememberPassword(e.target.checked)} className="w-4 h-4 text-blue-600 bg-slate-50 dark:bg-[#0f172a] border-slate-300 dark:border-slate-700 rounded focus:ring-blue-500 focus:ring-2" />
              <label htmlFor="remember" className="text-sm font-bold text-slate-600 dark:text-slate-400 cursor-pointer">Ghi nhớ mật khẩu</label>
            </div>
            {loginError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-shake">
                <p className="text-xs font-bold text-red-600 text-center uppercase tracking-wider">{loginError}</p>
              </div>
            )}
            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-extrabold hover:bg-blue-700 transition-all uppercase text-sm tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 btn-primary">Đăng nhập</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-inter text-slate-600 selection:bg-blue-100 selection:text-blue-700">
      {/* SIDEBAR */}
      <aside className="print:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-[#1e293b] border-r border-slate-100 dark:border-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all md:relative md:translate-x-0">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <Warehouse size={24} />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-800 dark:text-white tracking-tight leading-none block">Smart<span className="text-blue-600 dark:text-blue-400">Stock</span></span>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">QUẢN LÝ KHO</p>
            </div>
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto no-scrollbar">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', permission: 'VIEW_DASHBOARD' },
            { id: 'inventory', icon: Package, label: 'Vật tư', permission: 'VIEW_INVENTORY' },
            { id: 'history', icon: History, label: 'Lịch sử', permission: 'VIEW_HISTORY' },
            { id: 'orders', icon: ClipboardList, label: 'Định mức', permission: 'VIEW_ORDERS' },
            ...(hasPermission('MANAGE_USERS') ? [{ id: 'users', icon: Users, label: 'Người dùng', permission: 'MANAGE_USERS' }] : []),
            ...(hasPermission('VIEW_ACTIVITY_LOG') ? [{ id: 'activity', icon: Activity, label: 'Nhật ký', permission: 'VIEW_ACTIVITY_LOG' }] : []),
            { id: 'credits', icon: Info, label: 'Tác giả', permission: 'ANY' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group flex items-center w-full gap-3 px-4 py-3.5 transition-all duration-300 relative ${activeTab === tab.id
                ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 hover:translate-x-1'
                }`}
            >
              {activeTab === tab.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 dark:bg-blue-400 rounded-r-full"></div>
              )}
              <div className={`transition-transform duration-300 ${activeTab === tab.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'group-hover:scale-110'}`}>
                <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              </div>
              <span className={`text-sm tracking-wide transition-all ${activeTab === tab.id ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></div>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-50 dark:border-slate-800">
          <div className="p-2 space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="w-9 h-9 bg-white dark:bg-[#0f172a] text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm border border-slate-100 dark:border-slate-700">{currentUser?.fullName?.[0] || userRole[0]}</div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">{currentUser?.fullName || (userRole === 'ADMIN' ? 'Quản trị viên' : userRole === 'MANAGER' ? 'Quản lý' : 'Nhân viên')}</p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase mt-0.5">{userRole}</p>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
            </div>
            <button onClick={() => setIsAccountModalOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all text-slate-600 dark:text-slate-300 shadow-sm text-xs font-bold uppercase tracking-wide">
              <UserIcon size={16} />
              Tài khoản
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#F8FAFC] dark:bg-[#0B1120]">
        {/* Printable History Overlay */}
        <div className="hidden print:block fixed inset-0 z-[500] bg-white p-10 font-serif overflow-visible">
          <div className="text-center border-b-2 border-black pb-4 mb-8">
            <h2 className="text-2xl font-extrabold uppercase tracking-tight">CÔNG TY SMART STOCK - BÁO CÁO KHO</h2>
            <p className="text-sm italic">Thời gian xuất báo cáo: {new Date().toLocaleString('vi-VN')}</p>
          </div>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold underline uppercase">Lịch sử giao dịch vật tư</h1>
            <p className="mt-2 font-bold italic">Kho/Xưởng: {historyFilter.workshop === 'ALL' ? 'Tất cả' : historyFilter.workshop}</p>
          </div>
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-slate-200 font-bold uppercase">
                <th className="border border-black px-2 py-3 text-center">Ngày</th>
                <th className="border border-black px-2 py-3">Mã phiếu</th>
                <th className="border border-black px-2 py-3">Vật tư</th>
                <th className="border border-black px-2 py-3 text-center">Xưởng</th>
                <th className="border border-black px-2 py-3 text-center">Loại GD</th>
                <th className="border border-black px-2 py-3 text-center">Số lượng</th>
                <th className="border border-black px-2 py-3">Ghi chú/Đơn hàng</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t, idx) => (
                <tr key={idx}>
                  <td className="border border-black px-2 py-2 text-center">{t.date}</td>
                  <td className="border border-black px-2 py-2 font-bold">{t.receiptId}</td>
                  <td className="border border-black px-2 py-2 uppercase">{t.materialName}</td>
                  <td className="border border-black px-2 py-2 text-center uppercase">{t.workshop}</td>
                  <td className="border border-black px-2 py-2 text-center">{t.type === 'IN' ? 'Nhập' : t.type === 'OUT' ? 'Xuất' : 'Chuyển'}</td>
                  <td className="border border-black px-2 py-2 text-center font-bold">{t.quantity}</td>
                  <td className="border border-black px-2 py-2">{t.orderCode || t.targetWorkshop || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-12 flex justify-between px-10 text-center font-bold italic">
            <div>Người lập báo cáo<br /><span className="font-normal text-[10px]">(Ký, ghi rõ họ tên)</span></div>
            <div>Ban giám đốc<br /><span className="font-normal text-[10px]">(Ký, đóng dấu)</span></div>
          </div>
        </div>

        <header className="print:hidden flex items-center justify-between px-8 py-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4">
            <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.4)]"></div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight capitalize">
                {activeTab === 'dashboard' ? 'Tổng quan' :
                  activeTab === 'inventory' ? 'Vật tư' :
                    activeTab === 'orders' ? 'Định mức' :
                      activeTab === 'history' ? 'Lịch sử' :
                        activeTab === 'users' ? 'Quản lý người dùng' :
                          activeTab === 'activity' ? 'Nhật ký hoạt động' :
                            activeTab === 'credits' ? 'Thông tin tác giả' :
                              'Tài khoản'}
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5 uppercase tracking-widest flex items-center gap-2">
                {connectionConfig.mode === 'SERVER' && serverIp && (
                  <span className="text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 px-1.5 rounded text-[10px]">HOST IP: {serverIp}</span>
                )}
                <span className="text-blue-600 dark:text-blue-400">{currentTime.toLocaleTimeString('vi-VN')}</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'dashboard' && (
              <select
                value={selectedWorkshop}
                onChange={e => setSelectedWorkshop(e.target.value as WorkshopCode)}
                className="px-4 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 shadow-sm transition-colors"
              >
                {WORKSHOPS.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
              </select>
            )}
            {activeTab === 'inventory' && (
              <button onClick={handleExportInventoryExcel} className="px-5 py-3 text-[11px] font-extrabold text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition-all flex items-center gap-2 uppercase tracking-widest border border-green-200"><Download size={16} /> Xuất Excel</button>
            )}
            {activeTab === 'history' && (
              <>
                <button onClick={handleExportExcel} className="px-5 py-3 text-[11px] font-extrabold text-green-700 bg-green-50 rounded-xl hover:bg-green-100 transition-all flex items-center gap-2 uppercase tracking-widest border border-green-200"><Download size={16} /> Xuất Excel</button>
                <button onClick={() => setIsPrintConfirmOpen(true)} className="px-5 py-3 text-[11px] font-extrabold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 uppercase tracking-widest"><Printer size={16} /> In báo cáo</button>
              </>
            )}
            {activeTab === 'orders' && (
              <div className="flex items-center gap-3">
                <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <button onClick={() => setOrdersWorkshopFilter('ALL')} className={`px-4 py-2 rounded-lg text-[10px] font-extrabold uppercase transition-all ${ordersWorkshopFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>Tất cả</button>
                  {WORKSHOPS.map(w => (
                    <button key={w.code} onClick={() => setOrdersWorkshopFilter(w.code)} className={`px-4 py-2 rounded-lg text-[10px] font-extrabold uppercase transition-all ${ordersWorkshopFilter === w.code ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>{w.code}</button>
                  ))}
                </div>
                {!isStaff && (
                  <button onClick={() => { setEditingBudget(null); setBudgetForm({ orderCode: '', workshop: 'OG', items: [] }); setIsBudgetModalOpen(true); }} className="px-5 py-3 text-[11px] font-extrabold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex items-center gap-2 uppercase tracking-widest btn-primary"><Plus size={16} /> Thêm dự toán</button>
                )}
              </div>
            )}
            {!isStaff && activeTab !== 'history' && activeTab !== 'orders' && (
              <>
                <button onClick={() => setIsTransferModalOpen(true)} className="px-5 py-3 text-[11px] font-bold text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2 uppercase tracking-widest border border-blue-200 hover:border-blue-300"><ArrowRightLeft size={16} /> Điều chuyển</button>
                <button onClick={() => setIsReceiptModalOpen(true)} className="px-5 py-3 text-[11px] font-extrabold text-white bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 rounded-xl hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 uppercase tracking-widest"><FileText size={16} /> Lập phiếu</button>
              </>
            )}
            {canModify && activeTab === 'inventory' && (
              <button onClick={() => {
                setEditingMaterial(null);
                setMaterialForm({
                  name: '', classification: 'Vật tư chính', unit: '', quantity: 0, minThreshold: 10, workshop: 'OG', origin: '', note: ''
                });
                setIsMaterialModalOpen(true);
              }} className="px-5 py-3 text-[11px] font-extrabold text-white bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 rounded-xl hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 uppercase tracking-widest"><Plus size={16} /> Thêm mới</button>
            )}

            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-transparent hover:border-blue-200 dark:hover:border-blue-900"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl ml-group relative transition-colors">
              <div className={`w-2 h-2 rounded-full ${lastSync ? 'bg-green-500' : 'bg-red-500'} ${isSyncing ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase">{isSyncing ? 'Đang đồng bộ...' : lastSync ? `Đồng bộ: ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Mất kết nối'}</span>
              <button onClick={() => loadData()} className="p-1 text-slate-400 hover:text-blue-600 transition-all"><RefreshCcw size={12} className={isSyncing ? 'animate-spin' : ''} /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 px-6 py-8 xl:px-12 overflow-y-auto no-scrollbar print:hidden">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'TỔNG VẬT TƯ',
                    value: summary.totalItems,
                    color: 'text-blue-600 dark:text-blue-400',
                    bg: 'bg-blue-50 dark:bg-blue-900/20',
                    icon: Package,
                    description: 'Loại vật tư đang quản lý'
                  },
                  {
                    label: 'NHẬP HÔM NAY',
                    value: summary.todayIn,
                    color: 'text-green-600 dark:text-green-400',
                    bg: 'bg-green-50 dark:bg-green-900/20',
                    icon: ArrowDownLeft,
                    description: 'Tổng số lượng nhập'
                  },
                  {
                    label: 'XUẤT HÔM NAY',
                    value: summary.todayOut,
                    color: 'text-orange-600 dark:text-orange-400',
                    bg: 'bg-orange-50 dark:bg-orange-900/20',
                    icon: ArrowUpRight,
                    description: 'Tổng số lượng xuất'
                  },
                  {
                    label: 'CẢNH BÁO TỒN',
                    value: summary.lowStockCount,
                    color: 'text-red-600 dark:text-red-400',
                    bg: 'bg-red-50 dark:bg-red-900/20',
                    icon: AlertTriangle,
                    description: 'Cần bổ sung ngay'
                  },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className={`bg-white dark:bg-[#1e293b] p-6 rounded-[20px] shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden border-t-4 ${i === 0 ? 'border-t-blue-500' :
                      i === 1 ? 'border-t-green-500' :
                        i === 2 ? 'border-t-orange-500' :
                          'border-t-red-500'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                        <stat.icon size={24} />
                      </div>
                    </div>
                    <p className="text-4xl font-extrabold text-slate-800 dark:text-white mb-1 tracking-tight">{stat.value}</p>
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 group-hover:text-slate-500 transition-colors">{stat.label}</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">{stat.description}</p>
                  </div>
                ))}
              </div>



              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Cảnh báo tồn kho thấp */}
                <div className="bg-white dark:bg-[#1e293b] rounded-[20px] border border-slate-100 dark:border-slate-700 p-8 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Cảnh báo tồn kho thấp</h3>
                    <span className="text-sm font-bold text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-full">{summary.lowStockCount} mục</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                    {summary.lowStockItems.length > 0 ? (
                      <div className="w-full space-y-3">
                        {summary.lowStockItems.map(m => (
                          <div key={m.id} className="p-4 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-700 group transition-all hover:border-blue-200 dark:hover:border-blue-500/30 hover:shadow-sm flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                              <AlertTriangle size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate uppercase">{m.name}</p>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 uppercase">{m.workshop} • Tồn: <span className="text-red-600 dark:text-red-400 font-bold">{m.quantity} {m.unit}</span></p>
                            </div>
                            {!isStaff && (
                              <button onClick={() => quickRestock(m)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"><ShoppingCart size={16} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-4">
                        <AlertTriangle size={64} className="text-slate-200 dark:text-slate-700" />
                        <p className="text-base font-bold text-slate-400 dark:text-slate-500">Không có cảnh báo</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Giao dịch gần đây */}
                <div className="bg-white dark:bg-[#1e293b] rounded-3xl border border-slate-100 dark:border-slate-700 p-8 flex flex-col shadow-sm card-elevated">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-extrabold text-slate-800 dark:text-white uppercase tracking-tight">Giao dịch gần đây</h3>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">{transactions.slice(0, 5).length} giao dịch</span>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
                    {transactions.slice(0, 5).map(t => (
                      <div key={t.id} className="p-5 bg-slate-50 dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-slate-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${t.type === TransactionType.IN ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : t.type === TransactionType.OUT ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                            {t.type === TransactionType.IN ? <ArrowDownLeft size={22} /> : t.type === TransactionType.OUT ? <ArrowUpRight size={22} /> : <ArrowRightLeft size={22} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-slate-800 dark:text-slate-200 text-base uppercase truncate">{t.materialName}</p>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">{t.date} • {t.receiptId}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-extrabold ${t.type === TransactionType.IN ? 'text-green-600 dark:text-green-400' : t.type === TransactionType.OUT ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {t.type === TransactionType.IN ? '+' : '-'}{t.quantity}
                            </p>
                            <p className={`text-[10px] font-extrabold uppercase ${t.type === TransactionType.IN ? 'text-green-600 dark:text-green-400' : t.type === TransactionType.OUT ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {t.type === TransactionType.IN ? 'NHẬP' : t.type === TransactionType.OUT ? 'XUẤT' : 'CHUYỂN'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {transactions.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-3 py-12">
                        <History size={48} />
                        <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Chưa có giao dịch</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="relative group flex-1">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Tìm vật tư theo tên, mã hoặc xuất xứ..." className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm text-slate-800 dark:text-slate-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                    <button onClick={() => setInventoryWorkshopFilter('ALL')} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${inventoryWorkshopFilter === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Tất cả Xưởng</button>
                    {WORKSHOPS.map(w => (
                      <button key={w.code} onClick={() => setInventoryWorkshopFilter(w.code)} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${inventoryWorkshopFilter === w.code ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>{w.code}</button>
                    ))}
                  </div>
                  <div className="flex p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                    <button onClick={() => setInventoryClassFilter('ALL')} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${inventoryClassFilter === 'ALL' ? 'bg-slate-800 dark:bg-slate-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Tất cả Loại</button>
                    <button onClick={() => setInventoryClassFilter('Vật tư chính')} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${inventoryClassFilter === 'Vật tư chính' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Chính</button>
                    <button onClick={() => setInventoryClassFilter('Vật tư phụ')} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${inventoryClassFilter === 'Vật tư phụ' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Phụ</button>
                  </div>
                </div>
              </div>
              <div className="bg-transparent">
                <table className="w-full text-left text-sm border-separate border-spacing-y-3 px-1">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Vật tư & Mã</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Xưởng</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Tồn / Định mức</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Loại</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Ghi chú</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.map(m => (
                      <tr key={m.id} className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 group">
                        <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-base uppercase leading-tight">{m.name}</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-1">#{m.id} • {m.origin}</p>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50 font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-xs">{m.workshop}</td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <div className="flex items-center gap-2">
                            <div className={`px-3 py-1.5 rounded-lg font-bold text-xs ${m.quantity <= m.minThreshold ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{m.quantity} / {m.minThreshold}</div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{m.unit}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${m.classification === 'Vật tư chính' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                            {m.classification}
                          </span>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs truncate">{m.note || '-'}</p>
                        </td>
                        <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50 text-right">
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canModify && (
                              <>
                                <button onClick={() => { setEditingMaterial(m); setMaterialForm(m); setIsMaterialModalOpen(true); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={18} /></button>
                                <button onClick={() => handleDeleteMaterial(m.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={18} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#1e293b] p-6 rounded-[20px] border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Tìm kiếm tổng quát */}
                  <div className="relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Tìm theo vật tư, mã phiếu, đơn hàng..."
                      className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                      value={historySearchTerm}
                      onChange={e => setHistorySearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Lọc theo mã đơn hàng */}
                  <div className="relative group">
                    <ClipboardList size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Lọc mã đơn hàng cụ thể..."
                      className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm"
                      value={historyFilter.orderCode}
                      onChange={e => setHistoryFilter({ ...historyFilter, orderCode: e.target.value })}
                    />
                  </div>

                  {/* Lọc theo ngày */}
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      className="flex-1 px-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                      value={historyFilter.startDate}
                      onChange={e => setHistoryFilter({ ...historyFilter, startDate: e.target.value })}
                    />
                    <span className="text-slate-300 dark:text-slate-600 font-bold">→</span>
                    <input
                      type="date"
                      className="flex-1 px-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                      value={historyFilter.endDate}
                      onChange={e => setHistoryFilter({ ...historyFilter, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50 dark:border-slate-700">
                  <div className="flex flex-wrap gap-4">
                    {/* Nhóm loại giao dịch */}
                    <div className="flex p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner">
                      <button onClick={() => setHistoryFilter({ ...historyFilter, type: 'ALL' })} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${historyFilter.type === 'ALL' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>Tất cả GD</button>
                      <button onClick={() => setHistoryFilter({ ...historyFilter, type: 'IN' })} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${historyFilter.type === 'IN' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>Nhập</button>
                      <button onClick={() => setHistoryFilter({ ...historyFilter, type: 'OUT' })} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${historyFilter.type === 'OUT' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>Xuất</button>
                      <button onClick={() => setHistoryFilter({ ...historyFilter, type: 'TRANSFER' })} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${historyFilter.type === 'TRANSFER' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>Chuyển</button>
                    </div>

                    {/* Nhóm xưởng */}
                    <div className="flex p-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner">
                      <button onClick={() => setHistoryFilter({ ...historyFilter, workshop: 'ALL' })} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${historyFilter.workshop === 'ALL' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>Tất cả Xưởng</button>
                      {WORKSHOPS.map(w => (
                        <button key={w.code} onClick={() => setHistoryFilter({ ...historyFilter, workshop: w.code })} className={`px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-all ${historyFilter.workshop === w.code ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>{w.code}</button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setHistoryFilter({ type: 'ALL', workshop: 'ALL', startDate: '', endDate: '', orderCode: '' });
                      setHistorySearchTerm('');
                    }}
                    className="px-5 py-2.5 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-white transition-all text-[11px] uppercase tracking-widest flex items-center gap-2 border border-slate-200 dark:border-slate-600 shadow-sm"
                  >
                    <RefreshCcw size={14} /> Làm mới bộ lọc
                  </button>
                </div>
              </div>
              <div className="bg-transparent">
                <table className="w-full text-left text-sm border-separate border-spacing-y-3 px-1">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Mã đơn / Phiếu</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Vật tư / Loại / Đơn vị</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Loại giao dịch</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider text-center">Xưởng</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider text-center">Số lượng</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Thời gian</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(t => {
                      const matInfo = materials.find(m => m.name === t.materialName);
                      return (
                        <tr key={t.id} className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 group">
                          <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                            <div className="flex flex-col">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase leading-snug">{t.orderCode || '-'}</p>
                              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight mt-1">Mã phiếu: {t.receiptId}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                            <div className="flex flex-col">
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm uppercase leading-tight mb-1">{t.materialName}</p>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${matInfo?.classification === 'Vật tư chính' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>
                                  {matInfo?.classification === 'Vật tư chính' ? 'Chính' : 'Phụ'}
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase">Đơn vị: {matInfo?.unit || '-'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                            <div className="flex items-center gap-2">
                              {t.type === 'IN' ? <ArrowDownLeft className="text-green-600 dark:text-green-400" size={16} /> : t.type === 'OUT' ? <ArrowUpRight className="text-red-600 dark:text-red-400" size={16} /> : <ArrowRightLeft className="text-blue-600 dark:text-blue-400" size={16} />}
                              <span className={`font-bold text-[11px] uppercase ${t.type === 'IN' ? 'text-green-600 dark:text-green-400' : t.type === 'OUT' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {t.type === 'IN' ? 'Nhập kho' : t.type === 'OUT' ? 'Xuất kho' : 'Điều chuyển'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                            <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-100 dark:border-slate-700">
                              {t.workshop}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                            <span className="text-base font-bold text-slate-800 dark:text-slate-200">{t.quantity}</span>
                          </td>
                          <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                            <p className="font-medium text-slate-600 dark:text-slate-400 text-sm tracking-tight">{formatLocalDate(t.date)}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium uppercase mt-1 opacity-60">ID: {t.id.split('-').pop()}</p>
                          </td>
                          <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50 text-right">
                            {canModify && (
                              <button
                                onClick={() => handleDeleteTransaction(t)}
                                className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Xóa và hoàn tồn"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && hasPermission('MANAGE_USERS') && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500 font-medium">Tổng số người dùng: <span className="text-blue-600 font-bold">{users.length}</span></p>
                <button onClick={() => { setEditingUser(null); setUserForm({ username: '', password: '', fullName: '', email: '', role: 'STAFF', permissions: ROLE_PERMISSIONS.STAFF, isActive: true }); setIsUserModalOpen(true); }} className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center gap-2 uppercase tracking-wide transition-all"><Plus size={16} /> Thêm người dùng</button>
              </div>
              <div className="bg-transparent">
                <table className="w-full text-left text-sm border-separate border-spacing-y-3 px-1">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Người dùng</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Vai trò</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Quyền hạn</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 group">
                        <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-bold text-sm">{(u.fullName || u.username || '?')[0].toUpperCase()}</div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{u.fullName || u.username}</p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">@{u.username} {u.email && `• ${u.email}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${u.role === 'ADMIN' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                            u.role === 'MANAGER' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                              'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>{u.role}</span>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{u.permissions.length} quyền</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 font-medium">{u.lastLogin ? `Đăng nhập: ${new Date(u.lastLogin).toLocaleDateString('vi-VN')}` : 'Chưa đăng nhập'}</p>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${u.isActive ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            }`}>{u.isActive ? 'Hoạt động' : 'Vô hiệu'}</span>
                        </td>
                        <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingUser(u); setUserForm({ ...u, password: '' }); setIsUserModalOpen(true); }} className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"><Edit2 size={18} /></button>
                            <button onClick={() => handleToggleUserStatus(u.id)} className={`p-2 rounded-lg transition-all ${u.isActive ? 'text-slate-400 dark:text-slate-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'}`} title={u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}>
                              {u.isActive ? <X size={18} /> : <CheckCircle2 size={18} />}
                            </button>
                            {u.id !== currentUser?.id && (
                              <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"><Trash2 size={18} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'activity' && hasPermission('VIEW_ACTIVITY_LOG') && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#1e293b] p-6 rounded-[20px] border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap gap-8 items-end">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-wider">Người dùng</label>
                  <select className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm" value={activityFilter.userId} onChange={e => setActivityFilter({ ...activityFilter, userId: e.target.value })}>
                    <option value="ALL">Tất cả người dùng</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase ml-1 tracking-wider">Loại hoạt động</label>
                  <select className="w-full p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm" value={activityFilter.entityType} onChange={e => setActivityFilter({ ...activityFilter, entityType: e.target.value })}>
                    <option value="ALL">Tất cả hoạt động</option>
                    <option value="MATERIAL">Vật tư</option>
                    <option value="TRANSACTION">Giao dịch</option>
                    <option value="BUDGET">Dự toán</option>
                    <option value="USER">Người dùng</option>
                    <option value="SYSTEM">Hệ thống</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setActivityFilter({ userId: 'ALL', entityType: 'ALL', startDate: '', endDate: '' })} className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all shadow-sm"><RefreshCcw size={20} /></button>
                  {currentUser?.role === 'ADMIN' && (
                    <button onClick={handleClearLogs} className="px-5 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center gap-2 border border-transparent dark:border-red-900/30">
                      <Trash2 size={16} /> Xóa tất cả
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-transparent">
                <table className="w-full text-left text-sm border-separate border-spacing-y-3 px-1">
                  <thead>
                    <tr>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Thời gian</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Người dùng</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Hành động</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Loại</th>
                      <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider">Chi tiết</th>
                      {currentUser?.role === 'ADMIN' && <th className="px-6 py-4 font-bold text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-wider text-right">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivityLogs.map(log => (
                      <tr key={log.id} className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 group">
                        <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{new Date(log.timestamp).toLocaleString('vi-VN')}</p>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-xs">{log.username}</p>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="font-medium text-slate-700 dark:text-slate-300">{log.action}</p>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${log.entityType === 'MATERIAL' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                            log.entityType === 'TRANSACTION' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                              log.entityType === 'BUDGET' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                log.entityType === 'USER' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                                  'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>{log.entityType}</span>
                        </td>
                        <td className="px-6 py-5 border-y border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50">
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium truncate max-w-xs">{log.details}</p>
                        </td>
                        {currentUser?.role === 'ADMIN' && (
                          <td className="px-6 py-5 rounded-r-2xl border-y border-r border-slate-100 dark:border-slate-700 group-hover:border-blue-100 dark:group-hover:border-blue-900/50 text-right">
                            <button onClick={() => handleDeleteLog(log.id)} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredActivityLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-slate-400 dark:text-slate-600">
                          <Activity size={48} className="mx-auto mb-3 opacity-50" />
                          <p className="font-bold">Chưa có hoạt động nào</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'credits' && (
            <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-[#1e293b] rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-sm min-h-[600px] relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
              <div className="max-w-4xl w-full text-center space-y-12 relative z-10 text-center">
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-2xl shadow-sm mb-2 animate-bounce">
                    <Heart size={48} fill="currentColor" />
                  </div>
                  <div>
                    <h2 className="text-5xl font-extrabold tracking-tighter uppercase leading-tight text-slate-800 dark:text-white">
                      Smart<span className="text-red-600 dark:text-red-500">Stock</span>
                    </h2>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] mt-2">Professional Warehouse Management</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                  {/* Card 1: Info */}
                  {/* Card 1: Info */}
                  <div className="bg-slate-50 dark:bg-[#0f172a] p-8 rounded-[24px] border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all group duration-300">
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                      <div className="w-1 h-5 bg-blue-600 dark:bg-blue-500 rounded-full"></div>
                      Thông tin phát triển
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-[#1e293b] rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-sm border border-slate-100 dark:border-slate-700">
                          <Users size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Tác giả & Ý tưởng</p>
                          <p className="text-lg font-extrabold text-slate-800 dark:text-white">Phạm Đức Duy</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white dark:bg-[#1e293b] rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 shadow-sm border border-slate-100 dark:border-slate-700">
                          <Info size={24} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Phiên bản hiện tại</p>
                          <p className="text-lg font-extrabold text-slate-800 dark:text-white">v3.7.0 <span className="text-blue-600 dark:text-blue-400 text-sm">PRO PREMIUM</span></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Gratitude */}
                  <div className="bg-slate-50 dark:bg-[#0f172a] p-8 rounded-[24px] border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all relative overflow-hidden group">
                    <div className="absolute -right-8 -bottom-8 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-500">
                      <Warehouse size={160} />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <div className="w-1 h-5 bg-blue-600 dark:bg-blue-500 rounded-full"></div>
                        Lời tri ân
                      </h3>
                      <p className="text-base font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                        "Ứng dụng này được xây dựng bởi <span className="font-extrabold text-slate-800 dark:text-white">Phạm Đức Duy</span> với niềm đam mê dành tặng riêng cho các anh chị em bộ phận <span className="font-extrabold text-slate-800 dark:text-white uppercase italic">Kho - HL Windows</span>.
                        <br /><br />
                        Chúc mọi người luôn mạnh khỏe, hạnh phúc và thành công trên mọi chặng đường." ❤️
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em]">Designed & Developed with ❤️ for You</p>
                  <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-4">Copyright © 2026 SmartStock. All Rights Reserved.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {budgets.filter(b => ordersWorkshopFilter === 'ALL' || b.workshop === ordersWorkshopFilter).map(b => {
                const getIssuedQuantity = (materialName: string) => {
                  return transactions
                    .filter(t => t.type === TransactionType.OUT && t.orderCode === b.orderCode && t.materialName === materialName)
                    .reduce((sum, t) => sum + t.quantity, 0);
                };

                const hasOverBudget = b.items.some(it => {
                  const issued = getIssuedQuantity(it.materialName);
                  return issued > it.estimatedQty;
                });

                return (
                  <div key={b.id} className={`bg-white dark:bg-[#1e293b] border rounded-[20px] p-6 shadow-sm hover:shadow-lg transition-all group relative ${hasOverBudget ? 'border-red-300 dark:border-red-900/50 bg-red-50/20 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">DỰ TOÁN: {b.workshop}</p>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{b.orderCode}</h3>
                          {hasOverBudget && (
                            <AlertTriangle className="text-red-600 dark:text-red-500" size={18} title="Có vật tư vượt dự toán" />
                          )}
                        </div>
                      </div>
                      {!isStaff && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingBudget(b); setBudgetForm({ orderCode: b.orderCode, workshop: b.workshop, items: [...b.items] }); setIsBudgetModalOpen(true); }} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteBudget(b.id)} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {b.items.slice(0, 3).map((it, i) => {
                        const issued = getIssuedQuantity(it.materialName);
                        const isOverBudget = issued > it.estimatedQty;
                        return (
                          <div key={i} className={`flex justify-between text-sm font-medium border-b pb-2 ${isOverBudget ? 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/20 px-2 py-1 rounded' : 'border-slate-50 dark:border-slate-700/50'}`}>
                            <div className="flex-1 min-w-0">
                              <span className={`truncate pr-4 uppercase block ${isOverBudget ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{it.materialName}</span>
                              {isOverBudget && (
                                <span className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">⚠ Vượt dự toán</span>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className={isOverBudget ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-800 dark:text-slate-200'}>
                                {issued} / {it.estimatedQty}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {b.items.length > 3 && <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-bold pt-2">+{b.items.length - 3} vật tư khác</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* CONFIRM DIALOG */}
      {
        confirmDialog.isOpen && (
          <div className="print:hidden fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6 modal-backdrop transition-all duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <div className={`mx-auto w-16 h-16 flex items-center justify-center rounded-2xl ${confirmDialog.type === 'danger' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                {confirmDialog.type === 'danger' ? <AlertTriangle size={32} /> : <HelpCircle size={32} />}
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{confirmDialog.title}</h4>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">Hủy</button>
                <button onClick={confirmDialog.onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl text-sm shadow-md transition-all ${confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Xác nhận</button>
              </div>
            </div>
          </div>
        )
      }

      {/* PRINT CONFIRMATION MODAL */}
      {
        isPrintConfirmOpen && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6 modal-backdrop transition-all">
            <div className="w-full max-w-sm bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-4 border-b border-slate-50 dark:border-slate-700 pb-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl"><Printer size={24} /></div>
                <div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Xác nhận in báo cáo</h4>
                  <p className="text-slate-400 dark:text-slate-500 font-medium uppercase text-[10px] tracking-wider">Hệ thống chuẩn bị xuất file in</p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-2.5 font-medium text-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-700 pb-2">
                  <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold">Số bản ghi:</span>
                  <span className="text-slate-700 dark:text-slate-200 font-bold">{filteredTransactions.length} giao dịch</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-slate-500 uppercase text-xs font-bold">Bộ lọc xưởng:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">{historyFilter.workshop === 'ALL' ? 'Tất cả' : historyFilter.workshop}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsPrintConfirmOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">Hủy bỏ</button>
                <button onClick={triggerActualPrint} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm shadow-md hover:bg-blue-700 transition-all">In ngay</button>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: MATERIAL (ADD/EDIT) */}
      {
        isMaterialModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 modal-backdrop transition-all">
            <div className="w-full max-w-lg bg-white dark:bg-[#1e293b] rounded-[20px] p-6 shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-50 dark:border-slate-700 pb-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><Package size={20} /></div>
                  {editingMaterial ? 'Sửa thông tin vật tư' : 'Thêm vật tư mới'}
                </h3>
                <button onClick={() => setIsMaterialModalOpen(false)} className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-all"><X size={20} /></button>
              </div>

              {modalError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">{modalError}</p>
                </div>
              )}
              <div className="space-y-4 overflow-y-auto no-scrollbar pr-1 flex-1 pb-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Tên vật tư</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" placeholder="Tên vật tư" value={materialForm.name} onChange={e => setMaterialForm({ ...materialForm, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Đơn vị tính</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" placeholder="Bộ, Bao, Cái..." value={materialForm.unit} onChange={e => setMaterialForm({ ...materialForm, unit: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Phân loại</label>
                    <select className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" value={materialForm.classification} onChange={e => setMaterialForm({ ...materialForm, classification: e.target.value as any })}>
                      <option value="Vật tư chính">Vật tư chính</option>
                      <option value="Vật tư phụ">Vật tư phụ</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Xưởng</label>
                    <select className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" value={materialForm.workshop} onChange={e => setMaterialForm({ ...materialForm, workshop: e.target.value as any })}>
                      {WORKSHOPS.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase ml-1">Số lượng tồn</label>
                      <div className="relative">
                        <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                        <input type="text" className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0f172a] border border-blue-200 dark:border-blue-800 rounded-xl font-bold text-blue-700 dark:text-blue-400 outline-none focus:border-blue-500 shadow-sm text-sm" value={materialForm.quantity} onChange={e => setMaterialForm({ ...materialForm, quantity: e.target.value })} placeholder="0.00" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Định mức tối thiểu</label>
                      <input type="text" className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" value={materialForm.minThreshold} onChange={e => setMaterialForm({ ...materialForm, minThreshold: e.target.value })} placeholder="0.00" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Xuất xứ</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm" placeholder="Việt Nam, Hòa Phát, Nhập khẩu..." value={materialForm.origin} onChange={e => setMaterialForm({ ...materialForm, origin: e.target.value })} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1">Ghi chú chi tiết</label>
                    <textarea
                      className="w-full px-4 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all h-24 resize-none shadow-sm"
                      placeholder="Nhập thông tin bổ sung..."
                      value={materialForm.note}
                      onChange={e => setMaterialForm({ ...materialForm, note: e.target.value })}
                    />
                  </div>
                </div>
                <div className="pt-4 shrink-0 border-t border-slate-50 dark:border-slate-700">
                  <button
                    onClick={handleSaveMaterial}
                    className="w-full py-4 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-xl font-extrabold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                  >
                    <Check size={18} /> {editingMaterial ? 'Cập nhật thay đổi' : 'Xác nhận tạo vật tư'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: TRANSFER (ENHANCED 4-8 LAYOUT WITH BATCH SUPPORT) */}
      {
        isTransferModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 modal-backdrop transition-all">
            <div className="w-full max-w-[95%] xl:max-w-[1600px] max-h-[90vh] bg-white dark:bg-[#1e293b] rounded-[20px] p-6 flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <button onClick={() => setIsTransferModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all z-50">
                <X size={24} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
              </button>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50 dark:border-slate-700 shrink-0">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><ArrowRightLeft size={20} /></div>
                  Điều chuyển vật tư
                </h3>
              </div>

              {modalError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2 shrink-0">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">{modalError}</p>
                </div>
              )}

              <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                {/* CỘT TRÁI (4): THÔNG TIN ĐIỀU CHUYỂN & HÀNG CHỜ */}
                <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Kho nguồn</label>
                        <select className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={transferForm.fromWorkshop} onChange={e => setTransferForm({ ...transferForm, fromWorkshop: e.target.value as any, items: [] })}>
                          {WORKSHOPS.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Kho đích</label>
                        <select className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={transferForm.toWorkshop} onChange={e => setTransferForm({ ...transferForm, toWorkshop: e.target.value as any })}>
                          {WORKSHOPS.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mã đơn hàng</label>
                        <input type="text" className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="VD: MDH001" value={transferForm.orderCode} onChange={e => setTransferForm({ ...transferForm, orderCode: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mã phiếu</label>
                        <input type="text" className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="Tự động" value={transferForm.receiptId} onChange={e => setTransferForm({ ...transferForm, receiptId: e.target.value })} />
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-sm">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><ShoppingCart size={16} /></div>
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Danh mục điều chuyển</h4>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-bold">{transferForm.items.length} Item</span>
                    </div>

                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 p-3">
                      {transferForm.items.length > 0 ? (
                        transferForm.items.map((item, idx) => {
                          const mat = materials.find(m => m.id === item.materialId);
                          return (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all">
                              <div className="min-w-0 flex-1 mr-3">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{mat?.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Tồn: {mat?.quantity} {mat?.unit}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200/50 dark:border-slate-700">
                                  <button onClick={() => {
                                    const newItems = [...transferForm.items];
                                    const current = parseNumber(newItems[idx].quantity);
                                    newItems[idx].quantity = Math.max(0, current - 1);
                                    setTransferForm({ ...transferForm, items: newItems });
                                  }} className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors w-6 h-6 flex items-center justify-center"><Minus size={12} /></button>
                                  <input type="text" className="w-16 bg-transparent text-center text-sm font-bold text-slate-800 dark:text-white outline-none" value={item.quantity || ''} onChange={e => {
                                    const newItems = [...transferForm.items];
                                    newItems[idx].quantity = e.target.value;
                                    setTransferForm({ ...transferForm, items: newItems });
                                  }} />
                                  <button onClick={() => {
                                    const newItems = [...transferForm.items];
                                    const current = parseNumber(newItems[idx].quantity);
                                    newItems[idx].quantity = current + 1;
                                    setTransferForm({ ...transferForm, items: newItems });
                                  }} className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-6 h-6 flex items-center justify-center"><Plus size={12} /></button>
                                </div>
                                <button onClick={() => setTransferForm({ ...transferForm, items: transferForm.items.filter((_, i) => i !== idx) })} className="p-2 text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 size={16} /></button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-3 opacity-60">
                          <ArrowRightLeft size={48} className="stroke-1" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-center px-8">Chọn vật tư từ danh sách bên phải để thêm vào phiếu</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleTransfer}
                    disabled={transferForm.items.length === 0}
                    className="w-full py-4 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-xl font-extrabold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
                  >
                    <Check size={18} /> Xác nhận Điều chuyển
                  </button>
                </div>

                {/* CỘT PHẢI (8): TÌM KIẾM & CHỌN VẬT TƯ (GRID VIEW) */}
                <div className="col-span-8 bg-slate-50 dark:bg-slate-800/30 rounded-[20px] p-6 flex flex-col overflow-hidden border border-slate-200/60 dark:border-slate-700/50 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 shrink-0">
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Tìm vật tư kho nguồn..." className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" value={transferForm.search} onChange={e => setTransferForm({ ...transferForm, search: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar">
                      <button onClick={() => setReceiptSearchClass('ALL')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${receiptSearchClass === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Tất cả</button>
                      <button onClick={() => setReceiptSearchClass('Vật tư chính')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${receiptSearchClass === 'Vật tư chính' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Chính</button>
                      <button onClick={() => setReceiptSearchClass('Vật tư phụ')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${receiptSearchClass === 'Vật tư phụ' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Phụ</button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                      {materials.filter(m => {
                        const matchSearch = m.name.toLowerCase().includes(transferForm.search.toLowerCase());
                        const matchClass = receiptSearchClass === 'ALL' || m.classification === receiptSearchClass;
                        const matchWorkshop = m.workshop === transferForm.fromWorkshop;
                        return matchSearch && matchClass && matchWorkshop;
                      }).map(m => {
                        const isInCart = transferForm.items.some(it => it.materialId === m.id);
                        return (
                          <button key={m.id} onClick={() => {
                            if (isInCart) {
                              setTransferForm({ ...transferForm, items: transferForm.items.filter(it => it.materialId !== m.id) });
                            } else {
                              setTransferForm({ ...transferForm, items: [...transferForm.items, { materialId: m.id, quantity: 1 }] });
                            }
                          }} className={`group relative p-3.5 text-left bg-white dark:bg-[#1e293b] border rounded-xl transition-all shadow-sm active:scale-[0.98] flex flex-col justify-between gap-3 h-full ${isInCart ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md'}`}>
                            <div className="min-w-0 w-full">
                              <h5 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase line-clamp-2 leading-tight mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-400">{m.name}</h5>
                              <span className={`px-1.5 py-0.5 ${m.classification === 'Vật tư chính' ? 'bg-blue-100/50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-orange-100/50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'} text-[10px] font-bold rounded uppercase inline-block`}>{m.classification === 'Vật tư chính' ? 'Chính' : 'Phụ'}</span>
                            </div>
                            <div className="flex items-end justify-between mt-auto pt-2 border-t border-slate-50 dark:border-slate-700 w-full">
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Tồn kho</p>
                                <p className="text-base font-bold text-slate-800 dark:text-white">{m.quantity} <span className="text-[10px] text-slate-400 font-medium uppercase">{m.unit}</span></p>
                              </div>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isInCart ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:bg-blue-600 dark:group-hover:text-white'}`}>
                                {isInCart ? <Check size={14} /> : <Plus size={14} />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {materials.filter(m => m.workshop === transferForm.fromWorkshop).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-4 py-20 opacity-60">
                        <Inbox size={48} className="stroke-1" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">Xưởng nguồn chưa có vật tư nào</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: LẬP PHIẾU */}
      {
        isReceiptModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden modal-backdrop transition-all">
            <div className="w-full max-w-[95%] xl:max-w-[1600px] max-h-[90vh] bg-white dark:bg-[#1e293b] rounded-[20px] p-6 flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <button onClick={() => setIsReceiptModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all z-50">
                <X size={24} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
              </button>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50 dark:border-slate-700 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight uppercase flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><FileText size={20} /></div>
                    Lập phiếu Nhập/Xuất kho
                  </h3>
                </div>
              </div>

              {modalError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2 shrink-0">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">{modalError}</p>
                </div>
              )}

              <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
                  <div className="bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-4">
                    <div className="flex p-1 bg-white dark:bg-[#0f172a] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <button onClick={() => setReceiptType(TransactionType.IN)} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-all ${receiptType === 'IN' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Nhập kho</button>
                      <button onClick={() => setReceiptType(TransactionType.OUT)} className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-all ${receiptType === 'OUT' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>Xuất kho</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Xưởng thực hiện</label>
                        <select className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={receiptWorkshop} onChange={e => setReceiptWorkshop(e.target.value as any)}>
                          {WORKSHOPS.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mã phiếu</label>
                          <input type="text" className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-200 uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={receiptId} onChange={e => setReceiptId(e.target.value.toUpperCase())} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mã đơn hàng</label>
                          <input type="text" className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-200 uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="DH..." value={orderCode} onChange={e => setOrderCode(e.target.value.toUpperCase())} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-sm">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400"><ShoppingCart size={16} /></div>
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Hàng chờ</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-bold">{selectedItems.length} Item</span>
                        <button onClick={() => setSelectedItems([])} className="text-[10px] font-bold text-red-500 dark:text-red-400 hover:text-red-600 uppercase hover:underline">Xóa hết</button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
                      {selectedItems.length > 0 ? (
                        selectedItems.map((it, idx) => {
                          const m = materials.find(mat => mat.id === it.materialId);
                          const currentInWorkshop = materials.find(mat => mat.name === m?.name && mat.workshop === receiptWorkshop);
                          return (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all">
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="font-bold text-sm uppercase truncate text-slate-700 dark:text-slate-200 leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{m?.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Tồn {receiptWorkshop}: <span className="text-slate-600 dark:text-slate-400">{currentInWorkshop?.quantity || 0}</span></p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-1 border border-slate-200/50 dark:border-slate-700">
                                  <button onClick={() => setSelectedItems(selectedItems.map((x, i) => i === idx ? { ...x, quantity: Math.max(0.01, parseNumber(x.quantity) - 1) } : x))} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400"><Minus size={12} /></button>
                                  <input type="text" className="w-16 bg-transparent text-center text-sm font-bold outline-none text-slate-800 dark:text-white" value={it.quantity} onChange={e => {
                                    setSelectedItems(selectedItems.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x));
                                  }} />
                                  <button onClick={() => setSelectedItems(selectedItems.map((x, i) => i === idx ? { ...x, quantity: parseNumber(x.quantity) + 1 } : x))} className="w-6 h-6 flex items-center justify-center text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"><Plus size={12} /></button>
                                </div>
                                <button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-3 opacity-60">
                          <ShoppingCart size={48} className="stroke-1" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-center px-8">Chưa có vật tư nào trong phiếu</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto">
                    {/* Buttons will be rendered by parent logic usually, but here checking if we need a submit button */}
                  </div>
                </div>

                {/* CỘT PHẢI: TÌM VẬT TƯ NGUỒN (WIDER) */}
                <div className="col-span-8 bg-slate-50 dark:bg-slate-800/20 rounded-[20px] p-6 flex flex-col overflow-hidden border border-slate-200/60 dark:border-slate-700/50 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 shrink-0">
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Gõ tên vật tư để tìm kiếm..." className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar shadow-sm">
                        <button onClick={() => setReceiptSearchWorkshop('ALL')} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all ${receiptSearchWorkshop === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Tất cả Xưởng</button>
                        {WORKSHOPS.map(w => <button key={w.code} onClick={() => setReceiptSearchWorkshop(w.code)} className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all ${receiptSearchWorkshop === w.code ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{w.code}</button>)}
                      </div>
                    </div>
                  </div>


                  <div className="flex gap-2 mb-6">
                    <button onClick={() => setReceiptSearchClass('ALL')} className={`px-6 py-2 rounded-xl text-[10px] font-extrabold uppercase transition-all border ${receiptSearchClass === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-[#0f172a] text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>Tất cả Loại</button>
                    <button onClick={() => setReceiptSearchClass('Vật tư chính')} className={`px-6 py-2 rounded-xl text-[10px] font-extrabold uppercase transition-all border ${receiptSearchClass === 'Vật tư chính' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-[#0f172a] text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>Chính</button>
                    <button onClick={() => setReceiptSearchClass('Vật tư phụ')} className={`px-6 py-2 rounded-xl text-[10px] font-extrabold uppercase transition-all border ${receiptSearchClass === 'Vật tư phụ' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white dark:bg-[#0f172a] text-slate-400 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>Phụ</button>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {materials.filter(m => {
                        const matchSearch = m.name.toLowerCase().includes(materialSearch.toLowerCase());
                        const matchWorkshop = receiptSearchWorkshop === 'ALL' || m.workshop === receiptSearchWorkshop;
                        const matchClass = receiptSearchClass === 'ALL' || m.classification === receiptSearchClass;
                        return matchSearch && matchWorkshop && matchClass;
                      }).map(m => (
                        <button key={m.id} onClick={() => { if (!selectedItems.find(it => it.materialId === m.id)) setSelectedItems([...selectedItems, { materialId: m.id, quantity: 1 }]); }} className="group relative w-full h-full p-4 text-left bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all shadow-sm active:scale-95">
                          <div className="flex flex-col h-full justify-between gap-3">
                            <div className="min-w-0">
                              <h5 className="font-extrabold text-[12px] text-slate-800 dark:text-white uppercase line-clamp-2 leading-tight mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-400">{m.name}</h5>
                              <div className="flex flex-wrap gap-1.5">
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-[8px] font-extrabold text-slate-500 dark:text-slate-300 rounded-md uppercase">{m.workshop}</span>
                                <span className={`px-2 py-0.5 ${m.classification === 'Vật tư chính' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'} text-[8px] font-extrabold rounded-md uppercase`}>{m.classification === 'Vật tư chính' ? 'Chính' : 'Phụ'}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Số lượng tồn</p>
                                <p className="text-sm font-extrabold text-slate-800 dark:text-white">{m.quantity} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{m.unit}</span></p>
                              </div>
                              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center transition-all group-hover:bg-blue-600 group-hover:text-white">
                                <Plus size={16} />
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    {materials.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-slate-300 dark:text-slate-600 gap-4">
                        <Package size={64} className="opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 italic">Không tìm thấy vật tư phù hợp</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-200/50">
                    <button
                      onClick={() => requestConfirm(
                        'Xác nhận in',
                        'Bạn có chắc chắn muốn in phiếu tạm này không?',
                        () => {
                          printCurrentVoucher();
                          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                        },
                        'info'
                      )}
                      disabled={selectedItems.length === 0}
                      className="px-6 py-3 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 rounded-xl font-extrabold uppercase text-[10px] flex items-center gap-2 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all"
                    >
                      <Printer size={16} /> In phiếu tạm
                    </button>
                    <button
                      onClick={handleCreateReceipt}
                      disabled={selectedItems.length === 0}
                      className={`px-10 py-3.5 rounded-xl font-extrabold shadow-lg flex items-center gap-2 uppercase text-[11px] tracking-widest active:scale-[0.98] transition-all disabled:opacity-30 ${receiptType === 'IN'
                        ? 'bg-gradient-to-br from-green-600 via-green-600 to-emerald-600 shadow-green-500/30 text-white'
                        : 'bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 shadow-blue-500/30 text-white'
                        } hover:shadow-[0_0_25px_rgba(0,0,0,0.15)] hover:translate-y-[-2px]`}
                    >
                      Xác nhận hoàn tất <Check size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: BUDGET OVERHAUL */}
      {
        isBudgetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 modal-backdrop transition-all">
            <div className="w-full max-w-[95%] xl:max-w-[1600px] max-h-[90vh] bg-white dark:bg-[#1e293b] rounded-[20px] p-6 flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <button onClick={() => setIsBudgetModalOpen(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all z-50">
                <X size={24} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400" />
              </button>
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50 dark:border-slate-700 shrink-0">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase flex items-center gap-3"><ClipboardList className="text-blue-600 dark:text-blue-400" size={20} /> {editingBudget ? 'Cập nhật dự toán' : 'Thiết lập dự toán mới'}</h3>
              </div>

              {modalError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2 shrink-0">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">{modalError}</p>
                </div>
              )}
              <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
                {/* CỘT TRÁI (4): THÔNG TIN ĐƠN HÀNG & DANH MỤC ĐÃ CHỌN */}
                <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
                  <div className="grid grid-cols-1 gap-4 bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-xl border border-slate-200/60 dark:border-slate-700/50">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mã đơn hàng</label>
                      <input type="text" className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-800 dark:text-slate-200 uppercase outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" placeholder="VD: DH01" value={budgetForm.orderCode} onChange={e => setBudgetForm({ ...budgetForm, orderCode: e.target.value.toUpperCase() })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Xưởng dự toán</label>
                      <select className="w-full px-3 py-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" value={budgetForm.workshop} onChange={e => setBudgetForm({ ...budgetForm, workshop: e.target.value as WorkshopCode })}>
                        {WORKSHOPS.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative shadow-sm">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20">
                      <div className="flex items-center gap-2">
                        <ListChecks size={16} className="text-blue-600 dark:text-blue-400" />
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Danh mục ({budgetForm.items.length})</h4>
                      </div>
                      <button onClick={() => setBudgetForm({ ...budgetForm, items: [] })} className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase hover:underline">Xóa hết</button>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar bg-white dark:bg-[#1e293b] p-2 space-y-2">
                      {budgetForm.items.length > 0 ? (
                        <div className="space-y-2">
                          {budgetForm.items.map((it, idx) => (
                            <div className="p-3 bg-white dark:bg-[#0f172a] border border-slate-100 dark:border-slate-700/50 rounded-xl flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-sm transition-all">
                              <div className="min-w-0 mr-3 flex-1">
                                <p className="font-bold text-sm uppercase truncate text-slate-700 dark:text-slate-200 leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{it.materialName}</p>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Đơn vị: {materials.find(m => m.name === it.materialName)?.unit || '-'}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input type="text" className="w-20 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-sm text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all" placeholder="0" value={it.estimatedQty || ''} onChange={e => {
                                  setBudgetForm({ ...budgetForm, items: budgetForm.items.map((x, i) => i === idx ? { ...x, estimatedQty: e.target.value } : x) });
                                }} />
                                <button onClick={() => setBudgetForm({ ...budgetForm, items: budgetForm.items.filter((_, i) => i !== idx) })} className="p-2 text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-3 opacity-60">
                          <Package size={48} className="stroke-1" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-center px-8">Chưa chọn vật tư nào</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveBudget}
                    className="w-full py-4 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-xl font-extrabold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> Lưu dự toán Đơn hàng
                  </button>
                </div>

                {/* CỘT PHẢI (8): TÌM KIẾM & CHỌN VẬT TƯ (GRID VIEW) */}
                <div className="col-span-8 bg-slate-50 dark:bg-slate-800/20 rounded-[20px] p-6 flex flex-col overflow-hidden border border-slate-200/60 dark:border-slate-700/50 shadow-inner">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 shrink-0">
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" placeholder="Gõ tên vật tư dự toán..." className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-slate-200 outline-none shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto no-scrollbar">
                      <button onClick={() => setReceiptSearchClass('ALL')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${receiptSearchClass === 'ALL' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Tất cả</button>
                      <button onClick={() => setReceiptSearchClass('Vật tư chính')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${receiptSearchClass === 'Vật tư chính' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Chính</button>
                      <button onClick={() => setReceiptSearchClass('Vật tư phụ')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${receiptSearchClass === 'Vật tư phụ' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>Phụ</button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                      {materials.filter(m => {
                        const matchSearch = m.name.toLowerCase().includes(materialSearch.toLowerCase());
                        const matchClass = receiptSearchClass === 'ALL' || m.classification === receiptSearchClass;
                        const matchWorkshop = m.workshop === budgetForm.workshop;
                        return matchSearch && matchClass && matchWorkshop;
                      }).map(m => {
                        const isSelected = budgetForm.items.some(it => it.materialName === m.name);
                        return (
                          <button key={m.id} onClick={() => { if (!isSelected) addBudgetItem(m); }} className={`group relative p-3.5 text-left bg-white dark:bg-[#1e293b] border rounded-xl transition-all shadow-sm active:scale-[0.98] flex flex-col justify-between gap-3 ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/10 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/10 dark:hover:bg-blue-900/10 hover:shadow-md'}`}>
                            <div className="min-w-0 w-full">
                              <h5 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase line-clamp-2 leading-tight mb-2 group-hover:text-blue-700 dark:group-hover:text-blue-400">{m.name}</h5>
                              <span className={`px-1.5 py-0.5 ${m.classification === 'Vật tư chính' ? 'bg-blue-100/50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-orange-100/50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'} text-[10px] font-bold rounded uppercase inline-block`}>{m.classification === 'Vật tư chính' ? 'Chính' : 'Phụ'}</span>
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50 dark:border-slate-700 w-full">
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{m.unit}</p>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:bg-blue-600 group-hover:text-white'}`}>
                                {isSelected ? <Check size={14} /> : <Plus size={14} />}
                              </div>
                            </div>
                            {isSelected && <div className="absolute top-2 right-2 flex gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                            </div>}
                          </button>
                        );
                      })}
                    </div>
                    {materials.filter(m => m.workshop === budgetForm.workshop).length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-4 py-20">
                        <AlertCircle size={64} className="opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 italic">Xưởng này chưa có vật tư nào</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: USER MANAGEMENT */}
      {
        isUserModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 modal-backdrop">
            <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#1e293b] rounded-[20px] p-8 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase flex items-center gap-3"><Users className="text-blue-600 dark:text-blue-400" size={24} /> {editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới'}</h3>
                <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"><X size={24} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400" /></button>
              </div>

              {modalError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} />
                  <p className="text-sm font-bold">{modalError}</p>
                </div>
              )}
              <div className="space-y-4 overflow-y-auto no-scrollbar pr-2 flex-1 pb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Tên đăng nhập *</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="username" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} disabled={!!editingUser} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">{editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}</label>
                    <input type="password" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="••••••••" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Họ và tên *</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="Nguyễn Văn A" value={userForm.fullName} onChange={e => setUserForm({ ...userForm, fullName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Email</label>
                    <input type="email" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-base text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="user@example.com" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Vai trò *</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-blue-500 focus:bg-white transition-all input-focus" value={userForm.role} onChange={e => {
                      const role = e.target.value as UserRole;
                      setUserForm({ ...userForm, role, permissions: ROLE_PERMISSIONS[role] });
                    }}>
                      <option value="STAFF">Nhân viên</option>
                      <option value="MANAGER">Quản lý</option>
                      <option value="ADMIN">Quản trị viên</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Trạng thái</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-blue-500 focus:bg-white transition-all input-focus" value={userForm.isActive ? 'true' : 'false'} onChange={e => setUserForm({ ...userForm, isActive: e.target.value === 'true' })}>
                      <option value="true">Hoạt động</option>
                      <option value="false">Vô hiệu hóa</option>
                    </select>
                  </div>
                </div>
                {hasPermission('MANAGE_SETTINGS') && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1 tracking-wider">Quyền hạn chi tiết</label>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                      {Object.entries(PERMISSIONS).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer">
                          <input type="checkbox" checked={userForm.permissions?.includes(key as Permission)} onChange={e => {
                            const perm = key as Permission;
                            const perms = userForm.permissions || [];
                            setUserForm({
                              ...userForm,
                              permissions: e.target.checked ? [...perms, perm] : perms.filter(p => p !== perm)
                            });
                          }} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-xs font-bold text-slate-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-4 shrink-0 border-t border-slate-100">
                <button
                  onClick={handleSaveUser}
                  className="w-full py-4 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-xl font-extrabold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                >
                  <Check size={18} /> {editingUser ? 'Lưu thay đổi người dùng' : 'Xác nhận tạo người dùng'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* MODAL: ACCOUNT MANAGEMENT */}
      {
        isAccountModalOpen && currentUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 modal-backdrop">
            <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#1e293b] rounded-[20px] p-8 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase flex items-center gap-3"><UserIcon className="text-blue-600 dark:text-blue-400" size={24} /> Quản lý tài khoản</h3>
                <button onClick={() => setIsAccountModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"><X size={24} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400" /></button>
              </div>

              {modalError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} />
                  <p className="text-sm font-bold">{modalError}</p>
                </div>
              )}
              <div className="space-y-4 overflow-y-auto no-scrollbar pr-2 flex-1 pb-4">
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-blue-600/20">{currentUser.fullName[0]}</div>
                    <div>
                      <p className="text-lg font-bold text-slate-800 dark:text-white">{currentUser.fullName}</p>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{currentUser.username}</p>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${currentUser.role === 'ADMIN' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        currentUser.role === 'MANAGER' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>{currentUser.role}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Họ và tên</label>
                    <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" value={accountForm.fullName || currentUser.fullName} onChange={e => setAccountForm({ ...accountForm, fullName: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Email</label>
                    <input type="email" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" value={accountForm.email || currentUser.email || ''} onChange={e => setAccountForm({ ...accountForm, email: e.target.value })} />
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-4 flex items-center gap-2"><Lock size={16} /> Đổi mật khẩu</h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mật khẩu hiện tại *</label>
                      <input type="password" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="••••••••" value={accountForm.currentPassword} onChange={e => setAccountForm({ ...accountForm, currentPassword: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Mật khẩu mới</label>
                      <input type="password" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="••••••••" value={accountForm.newPassword} onChange={e => setAccountForm({ ...accountForm, newPassword: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase ml-1 tracking-wider">Xác nhận mật khẩu mới</label>
                      <input type="password" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#0f172a] transition-all input-focus" placeholder="••••••••" value={accountForm.confirmPassword} onChange={e => setAccountForm({ ...accountForm, confirmPassword: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 shrink-0 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn thiết lập lại kết nối? Ứng dụng sẽ khởi động lại.')) {
                      localStorage.removeItem('connection_config');
                      window.location.reload();
                    }
                  }}
                  className="w-full py-4 border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold rounded-xl transition-all uppercase tracking-wider text-xs hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={16} /> Thiết lập lại kết nối
                </button>

                {connectionConfig.mode === 'SERVER' && (
                  <button
                    onClick={handleBackup}
                    className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all uppercase tracking-wider text-xs hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> Sao lưu dữ liệu (Desktop)
                  </button>
                )}
                <button
                  onClick={handleUpdateAccount}
                  className="w-full py-4 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 text-white rounded-xl font-extrabold shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Lưu cập nhật tài khoản
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
