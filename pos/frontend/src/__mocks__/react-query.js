// Mock implementation of react-query
export const useQuery = () => ({
  data: null,
  isLoading: false,
  error: null,
  refetch: jest.fn(),
});

export const useMutation = () => ({
  mutate: jest.fn(),
  isLoading: false,
  error: null,
});

export const useQueryClient = () => ({
  invalidateQueries: jest.fn(),
});

export const QueryClient = class {
  constructor() {
    this.invalidateQueries = jest.fn();
  }
};

export const QueryClientProvider = ({ children }) => children;

export default {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
};
