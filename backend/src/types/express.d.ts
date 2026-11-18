// Express type extensions for authentication and request tracking
import { UserDocument } from '@models/User';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: UserDocument & { id: string; role: 'user' | 'admin' };
      resource?: any; // For owner-validated resources
    }
  }
}

export {};