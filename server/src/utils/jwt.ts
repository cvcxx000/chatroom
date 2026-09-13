import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  isAdmin: boolean;
}

// [安全] 显式固定为 HS256 单一对称算法：
// 1) 签名时指定 algorithm: 'HS256'；
// 2) 校验时通过 algorithms: ['HS256'] 白名单，拒绝 alg:none、RS256 混淆等攻击。
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  }) as jwt.JwtPayload & JwtPayload;
  return { userId: decoded.userId, isAdmin: decoded.isAdmin };
}
