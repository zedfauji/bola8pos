// Mock implementation of useToast hook
export const useToast = () => {
  return {
    toast: (options) => {
      console.log('Toast:', options);
      return { id: 'mock-toast-id' };
    },
    dismiss: (toastId) => {
      console.log('Dismiss toast:', toastId);
    },
    toasts: [],
  };
};

export default useToast;
