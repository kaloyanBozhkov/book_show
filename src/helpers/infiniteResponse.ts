export const infiniteResponse = <T>(
  items: T[],
  offset: number,
  pageSize: number
) => {
  return {
    items,
    nextCursor: items.length === pageSize ? offset + pageSize : undefined,
  };
};
