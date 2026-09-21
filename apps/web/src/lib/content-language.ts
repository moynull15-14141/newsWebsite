export function contentLanguage(text?: string | null): 'bn' | undefined {
  return text && /[\u0980-\u09FF]/.test(text) ? 'bn' : undefined;
}
