import { useState } from 'react';

export function useConfirm() {
  const [state, setState] = useState(null);

  function confirm(title, message, onConfirm) {
    setState({ title, message, onConfirm });
  }

  const dialogProps = {
    open: Boolean(state),
    title: state?.title,
    message: state?.message,
    onConfirm: () => {
      state.onConfirm();
      setState(null);
    },
    onCancel: () => setState(null),
  };

  return { confirm, dialogProps };
}
