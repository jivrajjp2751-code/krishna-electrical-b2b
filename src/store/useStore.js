import { create } from 'zustand';
import { fetchAllData, saveData } from '../utils/api';
import { hashPassword, verifyPassword, checkRateLimit, recordFailedAttempt, clearLoginAttempts } from '../utils/security';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// Data is now persisted in Supabase cloud — localStorage is only a fast cache

// ── localStorage helpers (fast cache) ───────────
const loadState = (key, fallback) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch { return fallback; }
};

const saveLocal = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
};

// ── Sync to backend (non-blocking) ──────────────
const saveToServer = (key, data) => {
  saveData(key, data).catch(() => {});
};

const saveBoth = (key, data) => {
  saveLocal(key, data);
  saveToServer(key, data);
};

// ── Default Data ────────────────────────────────
const defaultProducts = [];
const defaultSuppliers = [];
const defaultCustomers = [];
const defaultPurchases = [];
const defaultSales = [];
const defaultEnquiries = [];

// Default users — passwords get auto-hashed on first load
const defaultUsers = [
  { id: '1', username: 'admin', password: 'admin123', name: 'Admin User', role: 'admin', email: 'krishna.electricalworks3@gmail.com' },
  { id: '2', username: 'staff', password: 'staff123', name: 'Staff User', role: 'staff', email: 'staff@krishnaelectrical.in' },
];

const defaultCompanyInfo = {
  name: 'M/S. Krishna Electrical Works',
  address: 'Block No-01:02, Bldg No-A5, Sector-18, Plot No-24, Nerul (W), Navi Mumbai-400 706',
  secondAddress: 'Block No-01:02, Bldg No-A-5, Sect-18, Plot No-24, Nerul(West), Navi Mumbai, Maharastra - 400 706',
  phone: '9022901053',
  phone2: '9323901053',
  email: 'krishna.electricalworks3@gmail.com',
  gstNumber: '27ASTPG0673J1ZB',
  pan: 'ASTPG0673J',
  bankName: 'State Bank of India',
  accountNo: '38765432100',
  ifsc: 'SBIN0001234',
  gstRate: 18,
  reminderDays: 30,
  specialty: 'Rewinding & Repairing of AC/DC Motors, Transformers, Generators, Rectifiers and Stabilizers etc. Designing, Cabling, Trouble Shooting & AMC\'s of Process Control Systems, Electrical & Electronic Panels, Machining, Installation & commissioning of all types of Fluid Transfer Pumps, Pressure Pumps, Gear Boxes, Supervision, Monitoring of process control Equipments',
};

const useStore = create((set, get) => ({
  // ── Server sync status ────────────────────────
  serverConnected: false,
  syncFromServer: async () => {
    try {
      const serverData = await fetchAllData();
      if (serverData && typeof serverData === 'object') {
        const updates = {};
        const keys = ['products', 'suppliers', 'customers', 'purchases', 'sales', 'users', 'companyInfo', 'enquiries', 'customReminders'];
        keys.forEach(key => {
          if (serverData[key] !== undefined) {
            updates[key] = serverData[key];
            saveLocal(key, serverData[key]); // sync to localStorage too
          }
        });
        set({ ...updates, serverConnected: true });
        console.log('[Sync] Data loaded from server');
      }
    } catch (err) {
      console.warn('[Sync] Server not available, using localStorage', err.message);
      set({ serverConnected: false });
    }
  },

  // ── Auth (Secured with hashing + rate limiting) ──
  currentUser: loadState('currentUser', null),
  users: loadState('users', defaultUsers),
  _passwordsMigrated: false,

  // Auto-migrate plaintext passwords to hashed on first load
  migratePasswords: async () => {
    if (get()._passwordsMigrated) return;
    const users = get().users;
    let needsMigration = false;
    const migrated = await Promise.all(users.map(async u => {
      // If password is short / looks plaintext (not a 64-char hex hash), hash it
      if (u.password && u.password.length < 64) {
        needsMigration = true;
        const hashed = await hashPassword(u.password, u.username);
        return { ...u, password: hashed };
      }
      return u;
    }));
    if (needsMigration) {
      saveBoth('users', migrated);
      set({ users: migrated, _passwordsMigrated: true });
      console.log('[Security] Passwords migrated to SHA-256 hashes');
    } else {
      set({ _passwordsMigrated: true });
    }
  },

  login: async (username, password) => {
    // Rate limiting check
    const rateCheck = checkRateLimit(username);
    if (!rateCheck.allowed) {
      return { success: false, message: rateCheck.message };
    }

    const users = get().users;
    const user = users.find(u => u.username === username);
    if (!user) {
      recordFailedAttempt(username);
      return { success: false, message: 'Invalid username or password' };
    }

    // Verify hashed password
    const isValid = await verifyPassword(password, user.password, user.username);
    if (!isValid) {
      const record = recordFailedAttempt(username);
      const remaining = Math.max(0, 5 - record.attempts);
      if (remaining === 0) {
        return { success: false, message: 'Too many failed attempts. Account locked for 5 minutes.' };
      }
      return { success: false, message: `Invalid username or password. ${remaining} attempt(s) remaining.` };
    }

    // Success!
    clearLoginAttempts(username);
    const userData = { ...user };
    delete userData.password;
    // Add session token for extra security
    userData._sessionToken = Date.now().toString(36) + Math.random().toString(36).substr(2);
    userData._loginAt = new Date().toISOString();
    set({ currentUser: userData });
    saveLocal('currentUser', userData);
    return { success: true, user: userData };
  },

  logout: () => {
    set({ currentUser: null });
    localStorage.removeItem('currentUser');
  },

  changePassword: async (userId, currentPassword, newPassword) => {
    const users = get().users;
    const user = users.find(u => u.id === userId);
    if (!user) return { success: false, message: 'User not found' };

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password, user.username);
    if (!isValid) return { success: false, message: 'Current password is incorrect' };

    // Hash the new password
    const hashedNew = await hashPassword(newPassword, user.username);
    const updated = users.map(u => u.id === userId ? { ...u, password: hashedNew } : u);
    saveBoth('users', updated);
    set({ users: updated });
    return { success: true };
  },

  // ── Products ──────────────────────────────────
  products: loadState('products', defaultProducts),
  addProduct: (product) => {
    const newProduct = { ...product, id: generateId() };
    set(state => {
      const updated = [...state.products, newProduct];
      saveBoth('products', updated);
      return { products: updated };
    });
  },
  updateProduct: (id, updates) => {
    set(state => {
      const updated = state.products.map(p => p.id === id ? { ...p, ...updates } : p);
      saveBoth('products', updated);
      return { products: updated };
    });
  },
  deleteProduct: (id) => {
    set(state => {
      const updated = state.products.filter(p => p.id !== id);
      saveBoth('products', updated);
      return { products: updated };
    });
  },

  // ── Suppliers ─────────────────────────────────
  suppliers: loadState('suppliers', defaultSuppliers),
  addSupplier: (supplier) => {
    const newSupplier = { ...supplier, id: generateId() };
    set(state => {
      const updated = [...state.suppliers, newSupplier];
      saveBoth('suppliers', updated);
      return { suppliers: updated };
    });
  },
  updateSupplier: (id, updates) => {
    set(state => {
      const updated = state.suppliers.map(s => s.id === id ? { ...s, ...updates } : s);
      saveBoth('suppliers', updated);
      return { suppliers: updated };
    });
  },
  deleteSupplier: (id) => {
    set(state => {
      const updated = state.suppliers.filter(s => s.id !== id);
      saveBoth('suppliers', updated);
      return { suppliers: updated };
    });
  },

  // ── Customers ─────────────────────────────────
  customers: loadState('customers', defaultCustomers),
  addCustomer: (customer) => {
    const newCustomer = { ...customer, id: generateId() };
    set(state => {
      const updated = [...state.customers, newCustomer];
      saveBoth('customers', updated);
      return { customers: updated };
    });
  },
  updateCustomer: (id, updates) => {
    set(state => {
      const updated = state.customers.map(c => c.id === id ? { ...c, ...updates } : c);
      saveBoth('customers', updated);
      return { customers: updated };
    });
  },
  deleteCustomer: (id) => {
    set(state => {
      const updated = state.customers.filter(c => c.id !== id);
      saveBoth('customers', updated);
      return { customers: updated };
    });
  },

  // ── Purchases ─────────────────────────────────
  purchases: loadState('purchases', defaultPurchases),
  addPurchase: (purchase) => {
    const newPurchase = { ...purchase, id: generateId() };
    set(state => {
      const updatedPurchases = [...state.purchases, newPurchase];
      const updatedProducts = state.products.map(p =>
        p.id === purchase.productId ? { ...p, stock: p.stock + Number(purchase.quantity) } : p
      );
      saveBoth('purchases', updatedPurchases);
      saveBoth('products', updatedProducts);
      return { purchases: updatedPurchases, products: updatedProducts };
    });
  },
  deletePurchase: (id) => {
    set(state => {
      const purchase = state.purchases.find(p => p.id === id);
      const updatedPurchases = state.purchases.filter(p => p.id !== id);
      const updatedProducts = purchase
        ? state.products.map(p =>
            p.id === purchase.productId ? { ...p, stock: Math.max(0, p.stock - Number(purchase.quantity)) } : p
          )
        : state.products;
      saveBoth('purchases', updatedPurchases);
      saveBoth('products', updatedProducts);
      return { purchases: updatedPurchases, products: updatedProducts };
    });
  },

  // ── Enquiries ─────────────────────────────────
  enquiries: loadState('enquiries', defaultEnquiries),
  addEnquiry: (enquiry) => {
    const newEnquiry = { ...enquiry, id: generateId(), status: enquiry.status || 'pending' };
    set(storeState => {
      const updated = [...storeState.enquiries, newEnquiry];
      saveBoth('enquiries', updated);
      return { enquiries: updated };
    });
    return newEnquiry;
  },
  updateEnquiry: (id, updates) => {
    set(state => {
      const updated = state.enquiries.map(e => e.id === id ? { ...e, ...updates } : e);
      saveBoth('enquiries', updated);
      return { enquiries: updated };
    });
  },
  deleteEnquiry: (id) => {
    set(state => {
      const updated = state.enquiries.filter(e => e.id !== id);
      saveBoth('enquiries', updated);
      return { enquiries: updated };
    });
  },

  // ── Sales ─────────────────────────────────────
  sales: loadState('sales', defaultSales),
  addSale: (sale) => {
    const state = get();
    const invoiceCount = state.sales.length + 1;
    const invoiceNo = `INV-${String(invoiceCount).padStart(3, '0')}`;
    const newSale = { ...sale, id: generateId(), invoiceNo, status: 'completed' };

    set(storeState => {
      const updatedSales = [...storeState.sales, newSale];
      let updatedProducts = [...storeState.products];
      sale.items.forEach(item => {
        updatedProducts = updatedProducts.map(p =>
          p.id === item.productId ? { ...p, stock: Math.max(0, p.stock - Number(item.quantity)) } : p
        );
      });
      const updatedCustomers = storeState.customers.map(c =>
        c.id === sale.customerId ? { ...c, lastOrderDate: sale.date } : c
      );
      saveBoth('sales', updatedSales);
      saveBoth('products', updatedProducts);
      saveBoth('customers', updatedCustomers);
      return { sales: updatedSales, products: updatedProducts, customers: updatedCustomers };
    });
    return newSale;
  },
  updateSale: (id, updates) => {
    set(state => {
      const updatedSales = state.sales.map(s => s.id === id ? { ...s, ...updates } : s);
      saveBoth('sales', updatedSales);
      return { sales: updatedSales };
    });
  },
  deleteSale: (id) => {
    set(state => {
      const sale = state.sales.find(s => s.id === id);
      const updatedSales = state.sales.filter(s => s.id !== id);
      let updatedProducts = [...state.products];
      if (sale) {
        sale.items.forEach(item => {
          updatedProducts = updatedProducts.map(p =>
            p.id === item.productId ? { ...p, stock: p.stock + Number(item.quantity) } : p
          );
        });
      }
      saveBoth('sales', updatedSales);
      saveBoth('products', updatedProducts);
      return { sales: updatedSales, products: updatedProducts };
    });
  },

  // ── Toasts ────────────────────────────────────
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = generateId();
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },

  // ── Sidebar ───────────────────────────────────
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleMobileSidebar: () => set(state => ({ sidebarMobileOpen: !state.sidebarMobileOpen })),
  closeMobileSidebar: () => set({ sidebarMobileOpen: false }),

  // ── Custom Reminders ──────────────────────────
  customReminders: loadState('customReminders', []),
  activeAlarms: [], // In-memory alarms currently ringing
  triggerAlarm: (reminder) => {
    set(state => {
      // prevent duplicate triggers
      if (state.activeAlarms.find(a => a.id === reminder.id)) return state;
      return { activeAlarms: [...state.activeAlarms, reminder] };
    });
  },
  dismissAlarm: (id) => {
    set(state => ({ activeAlarms: state.activeAlarms.filter(a => a.id !== id) }));
  },
  addCustomReminder: (reminder) => {
    const newReminder = { ...reminder, id: generateId(), createdAt: new Date().toISOString(), status: 'pending' };
    set(state => {
      const updated = [...state.customReminders, newReminder];
      saveBoth('customReminders', updated);
      // Notify SW about the new reminder
      try {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'ADD_REMINDER', payload: newReminder });
        }
      } catch { /* ignore */ }
      return { customReminders: updated };
    });
  },
  completeCustomReminder: (id) => {
    set(state => {
      const updated = state.customReminders.map(r => r.id === id ? { ...r, status: 'completed' } : r);
      saveBoth('customReminders', updated);
      // Notify SW
      try {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'COMPLETE_REMINDER', payload: { id } });
        }
      } catch { /* ignore */ }
      return { customReminders: updated };
    });
  },
  deleteCustomReminder: (id) => {
    set(state => {
      const updated = state.customReminders.filter(r => r.id !== id);
      saveBoth('customReminders', updated);
      // Notify SW
      try {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'REMOVE_REMINDER', payload: { id } });
        }
      } catch { /* ignore */ }
      return { customReminders: updated };
    });
  },

  // ── Settings ──────────────────────────────────
  companyInfo: loadState('companyInfo', defaultCompanyInfo),
  updateCompanyInfo: (updates) => {
    set(state => {
      const updated = { ...state.companyInfo, ...updates };
      saveBoth('companyInfo', updated);
      return { companyInfo: updated };
    });
  },

  // ── Helper Getters ────────────────────────────
  getProductById: (id) => get().products.find(p => p.id === id),
  getSupplierById: (id) => get().suppliers.find(s => s.id === id),
  getCustomerById: (id) => get().customers.find(c => c.id === id),
  getLowStockProducts: () => get().products.filter(p => p.stock <= p.minStock),
  getInactiveCustomers: () => {
    const days = get().companyInfo.reminderDays || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return get().customers.filter(c => {
      if (!c.lastOrderDate) return true;
      return new Date(c.lastOrderDate) < cutoffDate;
    });
  },
  getCustomerHistory: (customerId) => {
    const state = get();
    const timeline = [];
    state.sales.filter(s => s.customerId === customerId).forEach(sale => {
      sale.items.forEach(item => {
        const product = state.products.find(p => p.id === item.productId);
        timeline.push({
          type: 'sale',
          date: sale.date,
          invoiceNo: sale.invoiceNo,
          product: product?.name || 'Unknown',
          quantity: item.quantity,
          unitPrice: item.sellingPrice,
          amount: item.total,
          gst: sale.gstAmount,
          totalAmount: sale.totalAmount,
          unit: product?.unit || '',
        });
      });
    });
    return timeline.sort((a, b) => a.date.localeCompare(b.date));
  },
  getPendingEnquiries: () => {
    return get().enquiries.filter(e => e.status === 'pending');
  },
}));

export default useStore;
