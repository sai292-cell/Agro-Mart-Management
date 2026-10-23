/**
 * Client API Service
 * Interacts with Shivshree Agro Mart OS Backend API
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

// In-memory access token storage (Never stored in localStorage per strict security guidelines)
let inMemoryAccessToken = null;

export function setApiAccessToken(token) {
  inMemoryAccessToken = token;
}

export function getApiAccessToken() {
  return inMemoryAccessToken;
}

/**
 * Common fetch helper with credentials: 'include' and automatic Bearer token injection
 */
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Ensures HTTP-only refresh cookies are sent/received
    });
  } catch (netErr) {
    const error = new Error('नेटवर्क संपर्क उपलब्ध नाही / Network connection unavailable. कृपया इंटरनेट किंवा सर्व्हर कनेक्शन तपासा.');
    error.status = 0;
    error.code = 'NETWORK_ERROR';
    error.isOffline = true;
    error.original = netErr;
    throw error;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorMessage =
      body?.error?.message || `HTTP Error: ${response.status} ${response.statusText}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = body?.error?.code || 'API_ERROR';
    error.details = body?.error;
    throw error;
  }

  return body;
}

/**
 * Checks backend health
 */
export async function checkApiHealth() {
  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP Error: ${response.status} ${response.statusText}`,
        latencyMs,
      };
    }

    const json = await response.json();
    return {
      ok: true,
      data: json.data,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Network error'),
      latencyMs,
    };
  }
}

// ==========================================
// Authentication Endpoints
// ==========================================

export async function loginApi(identifier, password) {
  const result = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  if (result.data?.accessToken) {
    setApiAccessToken(result.data.accessToken);
  }
  return result.data;
}

export async function refreshApi() {
  const result = await apiFetch('/auth/refresh', {
    method: 'POST',
  });
  if (result.data?.accessToken) {
    setApiAccessToken(result.data.accessToken);
  }
  return result.data;
}

export async function logoutApi() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } finally {
    setApiAccessToken(null);
  }
}

export async function getMeApi() {
  const result = await apiFetch('/auth/me', { method: 'GET' });
  return result.data?.user;
}

export async function customerRegisterApi(formData) {
  const result = await apiFetch('/auth/customer/register', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  return result;
}

export async function customerLoginApi(farmerId, password) {
  const result = await apiFetch('/auth/customer/login', {
    method: 'POST',
    body: JSON.stringify({ farmerId, password }),
  });
  if (result.data?.accessToken) {
    setApiAccessToken(result.data.accessToken);
  }
  return result.data;
}

export async function ownerResetCustomerPasswordApi(customerId, newPassword, confirmNewPassword, reason) {
  return apiFetch(`/auth/customer/${customerId}/reset-password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword, confirmNewPassword, reason }),
  });
}

// ==========================================
// Category Endpoints
// ==========================================

export async function getCategoriesApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/categories?${query}` : '/categories';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function createCategoryApi(data) {
  const result = await apiFetch('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateCategoryApi(id, data) {
  const result = await apiFetch(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

// ==========================================
// Product Endpoints
// ==========================================

export async function getProductsApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/products?${query}` : '/products';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getProductDetailsApi(id) {
  const result = await apiFetch(`/products/${id}`, { method: 'GET' });
  return result.data;
}

export async function createProductApi(data) {
  const result = await apiFetch('/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateProductApi(id, data) {
  const result = await apiFetch(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function toggleProductStatusApi(id, active) {
  const result = await apiFetch(`/products/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
  return result.data;
}

export async function getLowStockProductsApi() {
  const result = await apiFetch('/products/reorder/low-stock', { method: 'GET' });
  return result.data;
}

// ==========================================
// Inventory & Stock Endpoints
// ==========================================

export async function getStockOverviewApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/inventory/stock?${query}` : '/inventory/stock';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getBatchesApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/inventory/batches?${query}` : '/inventory/batches';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function updateBatchStatusApi(id, data) {
  const result = await apiFetch(`/inventory/batches/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordStockReceiptApi(data) {
  const result = await apiFetch('/inventory/receipt', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordStockAdjustmentApi(data) {
  const result = await apiFetch('/inventory/adjustment', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getStockMovementsApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/inventory/movements?${query}` : '/inventory/movements';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

// ==========================================
// Billing & Invoicing Endpoints
// ==========================================

export async function checkoutInvoiceApi(data, idempotencyKey = null) {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const result = await apiFetch('/invoices', {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getInvoicesApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/invoices?${query}` : '/invoices';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getInvoiceDetailsApi(id) {
  const result = await apiFetch(`/invoices/${id}`, { method: 'GET' });
  return result.data;
}

export async function recordInvoicePaymentApi(id, data, idempotencyKey = null) {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const result = await apiFetch(`/invoices/${id}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function cancelInvoiceApi(id, data) {
  const result = await apiFetch(`/invoices/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getBillingCustomersApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/invoices/customers?${query}` : '/invoices/customers';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function quickCreateCustomerApi(data) {
  const result = await apiFetch('/invoices/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export function getInvoicePrintUrl(id) {
  return `${API_BASE_URL}/invoices/${id}/print`;
}

// ==========================================
// Customer Credit Ledger & Khaata Endpoints
// ==========================================

export async function getCustomersApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/customers?${query}` : '/customers';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getCustomerDetailsApi(id) {
  const result = await apiFetch(`/customers/${id}`, { method: 'GET' });
  return result.data;
}

export async function getCustomerStatementApi(id, params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/customers/${id}/statement?${query}` : `/customers/${id}/statement`;
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export function getCustomerPrintStatementUrl(id, params = {}) {
  const query = new URLSearchParams({ ...params, format: 'html' }).toString();
  return `${API_BASE_URL}/customers/${id}/statement?${query}`;
}

export async function recordCustomerAccountPaymentApi(id, data, idempotencyKey = null) {
  const headers = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const result = await apiFetch(`/customers/${id}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordCustomerAdjustmentApi(id, data) {
  const result = await apiFetch(`/customers/${id}/adjustments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordCustomerOpeningBalanceApi(id, data) {
  const result = await apiFetch(`/customers/${id}/opening-balance`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function reverseCustomerLedgerEntryApi(entryId, data) {
  const result = await apiFetch(`/customers/ledger/${entryId}/reversal`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function updateCustomerCreditLimitApi(id, data) {
  const result = await apiFetch(`/customers/${id}/credit-limit`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getCustomerReconciliationReportApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/customers/reconciliation/report?${query}` : '/customers/reconciliation/report';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

// Customer Self-Service Endpoints
export async function getMyCreditProfileApi() {
  const result = await apiFetch('/customers/my/profile', { method: 'GET' });
  return result.data;
}

export async function getMyPassbookApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/customers/my/passbook?${query}` : '/customers/my/passbook';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

// ==========================================
// Supplier & Accounts Payable Endpoints
// ==========================================

export async function getSuppliersApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/suppliers?${query}` : '/suppliers';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result;
}

export async function createSupplierApi(data) {
  const result = await apiFetch('/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getSupplierDetailsApi(id) {
  const result = await apiFetch(`/suppliers/${id}`, { method: 'GET' });
  return result.data;
}

export async function updateSupplierApi(id, data) {
  const result = await apiFetch(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getSupplierStatementApi(id, params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/suppliers/${id}/statement?${query}` : `/suppliers/${id}/statement`;
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result;
}

export async function recordSupplierPaymentApi(id, data) {
  const result = await apiFetch(`/suppliers/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordSupplierAdjustmentApi(id, data) {
  const result = await apiFetch(`/suppliers/${id}/adjustments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordSupplierOpeningBalanceApi(id, data) {
  const result = await apiFetch(`/suppliers/${id}/opening-balance`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function reverseSupplierEntryApi(id, entryId, data) {
  const result = await apiFetch(`/suppliers/${id}/entries/${entryId}/reverse`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getSupplierReconciliationReportApi(id) {
  const result = await apiFetch(`/suppliers/${id}/reconciliation`, { method: 'GET' });
  return result.data;
}

// ==========================================
// Purchase Inward Endpoints
// ==========================================

export async function getPurchasesApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/purchases?${query}` : '/purchases';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result;
}

export async function createPurchaseApi(data) {
  const result = await apiFetch('/purchases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getPurchaseDetailsApi(id) {
  const result = await apiFetch(`/purchases/${id}`, { method: 'GET' });
  return result.data;
}

export async function receivePurchaseApi(id, data = {}) {
  const result = await apiFetch(`/purchases/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function cancelPurchaseApi(id, data) {
  const result = await apiFetch(`/purchases/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function recordPurchaseReturnApi(id, data) {
  const result = await apiFetch(`/purchases/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

// ==========================================
// Operating Expenses Endpoints
// ==========================================

export async function getExpensesApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/expenses?${query}` : '/expenses';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result;
}

export async function createExpenseApi(data) {
  const result = await apiFetch('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getExpenseDetailsApi(id) {
  const result = await apiFetch(`/expenses/${id}`, { method: 'GET' });
  return result.data;
}

export async function approveExpenseApi(id) {
  const result = await apiFetch(`/expenses/${id}/approve`, { method: 'PATCH' });
  return result.data;
}

export async function rejectExpenseApi(id, data) {
  const result = await apiFetch(`/expenses/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function reverseExpenseApi(id, data) {
  const result = await apiFetch(`/expenses/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getExpenseCategoriesSummaryApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/expenses/categories/summary?${query}` : '/expenses/categories/summary';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

// ==========================================
// Cashbook & Drawer Sessions Endpoints
// ==========================================

export async function getActiveCashSessionApi() {
  const result = await apiFetch('/cashbook/session/current', { method: 'GET' });
  return result.data;
}

export async function openCashSessionApi(data) {
  const result = await apiFetch('/cashbook/session/open', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function closeCashSessionApi(data) {
  const result = await apiFetch('/cashbook/session/close', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return result.data;
}

export async function getCashSessionsApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/cashbook/sessions?${query}` : '/cashbook/sessions';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result;
}

export async function getCashMovementsApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/cashbook/movements?${query}` : '/cashbook/movements';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

// ==========================================
// Daily Closing Endpoints
// ==========================================

export async function getDailyClosingSummaryApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/daily-closing/summary?${query}` : '/daily-closing/summary';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getDailyClosingHistoryApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/daily-closing/history?${query}` : '/daily-closing/history';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

// ==========================================
// Reports & Profitability Endpoints
// ==========================================

export async function getSalesReportApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/reports/sales?${query}` : '/reports/sales';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getProfitabilityReportApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/reports/profitability?${query}` : '/reports/profitability';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getExpensesReportApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/reports/expenses?${query}` : '/reports/expenses';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export async function getReceivablesAndPayablesApi() {
  const result = await apiFetch('/reports/receivables-payables', { method: 'GET' });
  return result.data;
}

export async function getInventoryValuationApi() {
  const result = await apiFetch('/reports/inventory-valuation', { method: 'GET' });
  return result.data;
}

export async function getFinancialSummaryApi(params = {}) {
  const query = new URLSearchParams(params).toString();
  const endpoint = query ? `/reports/financial-summary?${query}` : '/reports/financial-summary';
  const result = await apiFetch(endpoint, { method: 'GET' });
  return result.data;
}

export { API_BASE_URL };



