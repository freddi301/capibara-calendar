export const isDragged = ({ pointerType }: { pointerType: string }) =>
  pointerType !== 'touch' && pointerType !== 'pen'
