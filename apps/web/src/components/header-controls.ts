export function getHeaderControlLabels(searchOpen: boolean, mobileOpen: boolean) {
  return {
    search: searchOpen ? 'Close search' : 'Search',
    menu: mobileOpen ? 'Close menu' : 'Menu',
  };
}
