import { useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Flower, AlertCircle } from 'lucide-react';

export function AuthPanel() {
  const { login, register, loading } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const referralCode = formData.get('referralCode') as string;
    const gcashNumber = formData.get('gcashNumber') as string;

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        if (!referralCode) {
          throw new Error('Referral code is required to register');
        }
        await register(username, password, referralCode, gcashNumber);
        setSuccess('Registration successful! Please wait for admin approval.');
        // Clear form using the ref
        formRef.current?.reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            FL
            <span className="inline-block animate-spin duration-[3000ms]">
              <Flower className="inline-block h-8 w-8 text-rose-500" />
            </span>
            WER BET
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLogin ? 'Welcome back!' : 'Join our community'}
          </p>
        </div>

        <div className="mt-8">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-rose-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-rose-500"
              />
            </div>

            {!isLogin && (
              <>
                <div>
                  <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700">
                    Referral Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-rose-500"
                    placeholder="Enter referral code"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    A valid referral code is required to register
                  </p>
                </div>

                <div>
                  <label htmlFor="gcashNumber" className="block text-sm font-medium text-gray-700">
                    GCash Number
                  </label>
                  <input
                    id="gcashNumber"
                    name="gcashNumber"
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-rose-500"
                    placeholder="Enter GCash number (optional)"
                  />
                </div>
              </>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <AlertCircle className="mr-2 h-5 w-5 text-red-400" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-700"
              disabled={loading}
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Register'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                  formRef.current?.reset();
                }}
                className="text-sm text-rose-600 hover:text-rose-500"
              >
                {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}