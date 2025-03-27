import toast from 'react-hot-toast';

export const notifySuccess = (message) => toast.success(message);
export const notifyError = (message) => toast.error(message);
export const notifyPromise = (promise, messages) => {
  return toast.promise(promise, messages);
};
