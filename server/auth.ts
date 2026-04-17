import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import bcrypt from "bcryptjs";

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      if (!user) return done(null, false, { message: "Incorrect username or password." });
      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return done(null, false, { message: "Incorrect username or password." });
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  })
);

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user ?? undefined);
  } catch (e) {
    done(e);
  }
});

export default passport;
