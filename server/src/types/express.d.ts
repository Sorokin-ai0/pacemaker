declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after verifying the pm_token JWT cookie. */
      userId: string;
    }
  }
}

export {};
