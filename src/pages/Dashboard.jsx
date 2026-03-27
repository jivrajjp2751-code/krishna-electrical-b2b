import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, ShoppingCart, Receipt, Package, Users, TrendingUp,
  TrendingDown, AlertTriangle, Download
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import useStore from '../store/useStore';
import { downloadCSV } from '../utils/csv';

const COLORS = ['#2d79f3', '#00bfa5', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const formatCurrency = (val) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
};

export default function Dashboard() {
  const products = useStore(s => s.products);
  const customers = useStore(s => s.customers);
  const suppliers = useStore(s => s.suppliers);
  const purchases = useStore(s => s.purchases);
  const sales = useStore(s => s.sales);
  const getLowStockProducts = useStore(s => s.getLowStockProducts);
  const getInactiveCustomers = useStore(s => s.getInactiveCustomers);
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const profit = totalSales - totalPurchases;
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    return { totalSales, totalPurchases, profit, totalStock };
  }, [sales, purchases, products]);

  const monthlySalesData = useMemo(() => {
    const months = {};
    sales.forEach(sale => {
      const month = sale.date.substring(0, 7);
      months[month] = (months[month] || 0) + sale.totalAmount;
    });
    const purchaseMonths = {};
    purchases.forEach(p => {
      const month = p.date.substring(0, 7);
      purchaseMonths[month] = (purchaseMonths[month] || 0) + p.totalAmount;
      if (!months[month]) months[month] = 0;
    });
    return Object.keys({ ...months, ...purchaseMonths }).sort().map(month => ({
      month: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      Sales: months[month] || 0,
      Purchases: purchaseMonths[month] || 0,
    }));
  }, [sales, purchases]);

  const topCustomers = useMemo(() => {
    const customerTotals = {};
    sales.forEach(sale => {
      customerTotals[sale.customerId] = (customerTotals[sale.customerId] || 0) + sale.totalAmount;
    });
    return Object.entries(customerTotals)
      .map(([id, total]) => {
        const customer = customers.find(c => c.id === id);
        return { name: customer?.name?.split(' ').slice(0, 2).join(' ') || 'Unknown', value: total };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales, customers]);

  const topProducts = useMemo(() => {
    const productTotals = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        productTotals[item.productId] = (productTotals[item.productId] || 0) + item.total;
      });
    });
    return Object.entries(productTotals)
      .map(([id, total]) => {
        const product = products.find(p => p.id === id);
        return { name: product?.name?.split('(')[0]?.trim() || 'Unknown', value: total };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sales, products]);

  const categoryStock = useMemo(() => {
    const cats = {};
    products.forEach(p => {
      cats[p.category] = (cats[p.category] || 0) + p.stock;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [products]);

  const lowStock = getLowStockProducts();
  const inactive = getInactiveCustomers();

  const addToast = useStore(s => s.addToast);

  const exportDashboard = () => {
    const data = [
      { Metric: 'Total Sales (₹)', Value: stats.totalSales },
      { Metric: 'Total Purchases (₹)', Value: stats.totalPurchases },
      { Metric: 'Profit (₹)', Value: stats.profit },
      { Metric: 'Profit Margin (%)', Value: stats.totalSales > 0 ? ((stats.profit / stats.totalSales) * 100).toFixed(1) : 0 },
      { Metric: 'Total Products', Value: products.length },
      { Metric: 'Total Stock Units', Value: stats.totalStock },
      { Metric: 'Active Suppliers', Value: suppliers.length },
      { Metric: 'Total Customers', Value: customers.length },
      { Metric: 'Total Sales Orders', Value: sales.length },
      { Metric: 'Total Purchase Orders', Value: purchases.length },
      { Metric: 'Low Stock Items', Value: lowStock.length },
      { Metric: 'Inactive Customers', Value: inactive.length },
    ];
    downloadCSV(data, 'Dashboard_Analytics');
    addToast('Dashboard analytics exported', 'success');
  };

  const exportAllSales = () => {
    const data = sales.map(s => {
      const customer = customers.find(c => c.id === s.customerId);
      return {
        'Invoice No': s.invoiceNo, Date: s.date, Customer: customer?.name || 'Unknown',
        'Items Count': s.items.length, 'Subtotal (₹)': s.subtotal,
        'GST (₹)': s.gstAmount, 'Total (₹)': s.totalAmount, Status: s.status,
      };
    });
    downloadCSV(data, 'All_Sales');
    addToast('Sales data exported', 'success');
  };

  const exportAllPurchases = () => {
    const data = purchases.map(p => {
      const supplier = suppliers.find(s => s.id === p.supplierId);
      const product = products.find(pr => pr.id === p.productId);
      return {
        'PO No': p.invoiceNo, Date: p.date, Supplier: supplier?.name || 'Unknown',
        Product: product?.name || 'Unknown', Quantity: p.quantity,
        'Unit Price (₹)': p.purchasePrice, 'Total (₹)': p.totalAmount,
      };
    });
    downloadCSV(data, 'All_Purchases');
    addToast('Purchase data exported', 'success');
  };

  const exportAllCustomers = () => {
    const data = customers.map(c => {
      const total = sales.filter(s => s.customerId === c.id).reduce((sum, s) => sum + s.totalAmount, 0);
      return {
        Name: c.name, 'Contact Person': c.contactPerson, Phone: c.phone,
        Email: c.email, Address: c.address, 'GST Number': c.gstNumber,
        'Credit Limit (₹)': c.creditLimit, 'Total Business (₹)': total,
        'Last Order': c.lastOrderDate || 'N/A',
      };
    });
    downloadCSV(data, 'All_Customers');
    addToast('Customer data exported', 'success');
  };

  return (
    <div className="slide-up">
      {/* Export Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button className="btn btn-sm btn-secondary" onClick={exportDashboard}><Download size={13} /> Analytics CSV</button>
        <button className="btn btn-sm btn-secondary" onClick={exportAllSales}><Download size={13} /> Sales CSV</button>
        <button className="btn btn-sm btn-secondary" onClick={exportAllPurchases}><Download size={13} /> Purchases CSV</button>
        <button className="btn btn-sm btn-secondary" onClick={exportAllCustomers}><Download size={13} /> Customers CSV</button>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card" onClick={() => navigate('/sales')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon blue"><IndianRupee size={20} /></div>
          <div className="stat-info">
            <h4>Total Sales</h4>
            <div className="stat-value">{formatCurrency(stats.totalSales)}</div>
            <div className="stat-change up"><TrendingUp size={12} /> {sales.length} orders</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/purchases')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon teal"><ShoppingCart size={20} /></div>
          <div className="stat-info">
            <h4>Total Purchases</h4>
            <div className="stat-value">{formatCurrency(stats.totalPurchases)}</div>
            <div className="stat-change">{purchases.length} orders</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={20} /></div>
          <div className="stat-info">
            <h4>Profit</h4>
            <div className="stat-value">{formatCurrency(stats.profit)}</div>
            <div className={`stat-change ${stats.profit >= 0 ? 'up' : 'down'}`}>
              {stats.profit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {stats.totalSales > 0 ? ((stats.profit / stats.totalSales) * 100).toFixed(1) : 0}% margin
            </div>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/products')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon orange"><Package size={20} /></div>
          <div className="stat-info">
            <h4>Total Stock</h4>
            <div className="stat-value">{stats.totalStock.toLocaleString('en-IN')}</div>
            <div className="stat-change">{products.length} products</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><h3>Sales vs Purchases</h3></div>
          <div className="card-body" style={{ padding: 12 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlySalesData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => formatCurrency(v)} width={60} />
                <Tooltip
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, undefined]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Sales" fill="#2d79f3" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Purchases" fill="#00bfa5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Top Customers</h3></div>
          <div className="card-body" style={{ padding: 12 }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={topCustomers}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => `${name.substring(0, 10)}${name.length > 10 ? '…' : ''} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#94a3b8' }}
                >
                  {topCustomers.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><h3>Top Selling Products</h3></div>
          <div className="card-body no-padding">
            <div className="table-container">
              <table className="data-table" style={{ minWidth: 300 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-info">{i + 1}</span></td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{p.value.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && (
                    <tr><td colSpan={3} className="text-center text-muted" style={{ padding: 20 }}>No sales data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Alerts & Notifications</h3>
            {(lowStock.length + inactive.length) > 0 && (
              <span className="badge badge-danger">{lowStock.length + inactive.length}</span>
            )}
          </div>
          <div className="card-body no-padding" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {lowStock.length === 0 && inactive.length === 0 ? (
              <div className="empty-state">
                <AlertTriangle size={36} />
                <h4>All Clear!</h4>
                <p>No alerts at this time</p>
              </div>
            ) : (
              <div>
                {lowStock.map(p => (
                  <div key={p.id} className="alert-item">
                    <span className="alert-dot danger" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>Stock: {p.stock} (Min: {p.minStock})</div>
                    </div>
                    <span className="badge badge-danger">Low</span>
                  </div>
                ))}
                {inactive.map(c => (
                  <div key={c.id} className="alert-item">
                    <span className="alert-dot warning" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>Last: {c.lastOrderDate || 'Never'}</div>
                    </div>
                    <span className="badge badge-warning">Follow Up</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Stock by Category</h3></div>
          <div className="card-body" style={{ padding: 12 }}>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={categoryStock}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {categoryStock.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Quick Summary</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                { label: 'Total Products', value: products.length, color: 'var(--primary-600)' },
                { label: 'Active Suppliers', value: suppliers.length, color: 'var(--accent-600)' },
                { label: 'Total Customers', value: customers.length, color: 'var(--success-600)' },
                { label: 'Total Purchases', value: purchases.length, color: 'var(--warning-600)' },
                { label: 'Total Sales', value: sales.length, color: 'var(--danger-600)' },
                { label: 'Low Stock Items', value: lowStock.length, color: lowStock.length > 0 ? 'var(--danger-600)' : 'var(--success-600)' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)'
                }}>
                  <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{item.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
