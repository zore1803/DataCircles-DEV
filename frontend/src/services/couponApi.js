// services/couponApi.js
import API from './api';

export const couponAPI = {
  getCoupons: (params) => API.get('/super-admin/coupons', { params }),
  getCoupon: (couponId) => API.get(`/super-admin/coupons/${couponId}`),
  createCoupon: (data) => API.post('/super-admin/coupons', data),
  updateCoupon: (couponId, data) => API.put(`/super-admin/coupons/${couponId}`, data),
  toggleCouponStatus: (couponId) => API.post(`/super-admin/coupons/${couponId}/toggle-status`),
  deleteCoupon: (couponId) => API.delete(`/super-admin/coupons/${couponId}`),
  searchOrganizations: (search) => API.get('/super-admin/coupons/organizations', { params: { search } }),
};
