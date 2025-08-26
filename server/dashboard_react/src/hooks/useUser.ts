import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store/store';
import { User } from '../store/userSlice';
import { logout, checkAuthStatus, setIsAuthenticated } from '../store/userSlice';
import { AppDispatch } from '../store/store';
import { setUser } from "../store/userSlice";

interface UseUserReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (userData: User) => void;
  setIsAuthenticated: (value: boolean) => void;
}

export const useUser = (): UseUserReturn => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.user
  );

  const setUserData = (userData: User) => {
    dispatch(setUser(userData));
  };

  const logoutUser = () => {
    dispatch(logout());
  };

  const checkAuth = async () => {
    await dispatch(checkAuthStatus());
  };



  const setIsAuthenticatedValue = (value: boolean) => {
    dispatch(setIsAuthenticated(value));
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    logout: logoutUser,
    checkAuth,
    setUser: setUserData,
    setIsAuthenticated: setIsAuthenticatedValue,
  };
};
