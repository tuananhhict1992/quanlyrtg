import rateLimit from 'express-rate-limit';

// Install only AFTER requireAuth: the key comes from a verified account, never a header.
export const authenticatedApiLimiter = () => rateLimit({
  windowMs:60000, limit:120,
  keyGenerator:(req:any)=>req.authUser.id,
  standardHeaders:'draft-8', legacyHeaders:false,
  message:{error:'Tài khoản gửi quá nhiều yêu cầu. Vui lòng thử lại sau một phút.'},
});
