import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateReferralCode } from '@/lib/utils';

interface User {
  id: string;
  username: string;
  points: number;
  cash: number;
  referralCode: string;
  isAdmin: boolean;
  approved: boolean;
  gcashNumber?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, referralCode: string, gcashNumber?: string) => Promise<void>;
  logout: () => void;
  updatePoints?: (userId: string, amount: number) => Promise<void>;
  updateCash?: (userId: string, amount: number) => Promise<void>;
}

// Username and password validation
const isValidUsername = (username: string): boolean => {
  // Only allow letters, numbers, and underscores
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  return usernameRegex.test(username);
};

const isValidPassword = (password: string): boolean => {
  // Only allow letters, numbers, and common symbols (!@#$%^&*_-)
  const passwordRegex = /^[a-zA-Z0-9!@#$%^&*_-]+$/;
  return passwordRegex.test(password);
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      login: async (username: string, password: string) => {
        if (!username || !password) {
          throw new Error('Username and password are required');
        }

        set({ loading: true });
        try {
          const q = query(
            collection(db, "users"), 
            where("username", "==", username.toLowerCase()),
            where("password", "==", password)
          );
          
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            if (!userData.approved) {
              throw new Error("Account pending approval");
            }

            // Update last login timestamp
            await updateDoc(doc(db, "users", userDoc.id), {
              lastLoginAt: new Date()
            });
            
            const user = {
              id: userDoc.id,
              username: userData.username,
              points: userData.points || 0,
              cash: userData.cash || 0,
              referralCode: userData.referralCode,
              isAdmin: userData.isAdmin || false,
              approved: userData.approved,
              gcashNumber: userData.gcashNumber
            };

            // Only add points/cash update methods for admin users
            const state: AuthState = { user, loading: false };
            if (userData.isAdmin) {
              state.updatePoints = async (userId: string, amount: number) => {
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);
                if (!userDoc.exists()) throw new Error('User not found');

                const currentPoints = userDoc.data().points || 0;
                const newPoints = currentPoints + amount;
                if (newPoints < 0) throw new Error('Insufficient points');

                await updateDoc(userRef, { points: newPoints });

                // Add transaction record
                await addDoc(collection(db, 'transactions'), {
                  userId,
                  username: userDoc.data().username,
                  amount,
                  type: 'admin_points_update',
                  description: `Admin ${get().user?.username} ${amount >= 0 ? 'added' : 'deducted'} ${Math.abs(amount)} points`,
                  timestamp: new Date(),
                  balanceAfter: {
                    points: newPoints,
                    cash: userDoc.data().cash || 0
                  }
                });
              };

              state.updateCash = async (userId: string, amount: number) => {
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);
                if (!userDoc.exists()) throw new Error('User not found');

                const currentCash = userDoc.data().cash || 0;
                const newCash = currentCash + amount;
                if (newCash < 0) throw new Error('Insufficient cash');

                await updateDoc(userRef, { cash: newCash });

                // Add transaction record
                await addDoc(collection(db, 'transactions'), {
                  userId,
                  username: userDoc.data().username,
                  amount,
                  type: 'admin_cash_update',
                  description: `Admin ${get().user?.username} ${amount >= 0 ? 'added' : 'deducted'} ${Math.abs(amount)} cash`,
                  timestamp: new Date(),
                  balanceAfter: {
                    points: userDoc.data().points || 0,
                    cash: newCash
                  }
                });
              };
            }

            set(state);
          } else {
            throw new Error("Invalid username or password");
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          console.error('Authentication error:', errorMessage);
          throw new Error(errorMessage);
        } finally {
          set({ loading: false });
        }
      },
      register: async (username: string, password: string, referralCode: string, gcashNumber?: string) => {
        if (!username || !password) {
          throw new Error("Username and password are required");
        }

        if (username.length < 3) {
          throw new Error("Username must be at least 3 characters long");
        }

        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long");
        }

        if (!isValidUsername(username)) {
          throw new Error("Username can only contain letters, numbers, and underscores");
        }

        if (!isValidPassword(password)) {
          throw new Error("Password can only contain letters, numbers, and common symbols (!@#$%^&*_-)");
        }

        set({ loading: true });
        try {
          username = username.toLowerCase();
          
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("username", "==", username));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            throw new Error("Username already taken");
          }

          const newUserData = {
            username,
            password,
            referralCode: generateReferralCode(),
            points: 0,
            cash: 0,
            isAdmin: false,
            approved: false,
            gcashNumber: gcashNumber || null,
            createdAt: new Date(),
            lastLoginAt: new Date()
          };

          if (referralCode) {
            const refQuery = query(usersRef, where("referralCode", "==", referralCode.toUpperCase()));
            const refSnapshot = await getDocs(refQuery);
            
            if (!refSnapshot.empty) {
              // Store referrer info but don't award points yet
              newUserData.referrerId = refSnapshot.docs[0].id;
              newUserData.referralPending = true;
            } else {
              throw new Error("Invalid referral code");
            }
          }

          const userRef = doc(collection(db, "users"));
          await setDoc(userRef, newUserData);
          
          set({ loading: false });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Registration failed';
          console.error('Registration error:', errorMessage);
          throw new Error(errorMessage);
        } finally {
          set({ loading: false });
        }
      },
      logout: () => {
        set({ user: null, updatePoints: undefined, updateCash: undefined });
        window.location.hash = '';
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user })
    }
  )
);