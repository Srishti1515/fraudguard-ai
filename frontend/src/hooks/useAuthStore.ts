import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

interface AuthState {
  token: string | null
  userId: number | null
  fullName: string | null
  isAdmin: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setAuth: (token: string, userId: number, fullName: string, isAdmin: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      fullName: null,
      isAdmin: false,
      isAuthenticated: false,

      setAuth: (token, userId, fullName, isAdmin) => {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        set({ token, userId, fullName, isAdmin, isAuthenticated: true })
      },

      login: async (email, password) => {
        const formData = new FormData()
        formData.append('username', email)
        formData.append('password', password)
        const { data } = await api.post('/auth/login', formData)
        api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
        set({
          token: data.access_token,
          userId: data.user_id,
          fullName: data.full_name,
          isAdmin: data.is_admin,
          isAuthenticated: true,
        })
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ token: null, userId: null, fullName: null, isAdmin: false, isAuthenticated: false })
      },
    }),
    {
      name: 'fraudguard-auth',
      partialize: (s) => ({ token: s.token, userId: s.userId, fullName: s.fullName, isAdmin: s.isAdmin, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`
        }
      },
    }
  )
)
