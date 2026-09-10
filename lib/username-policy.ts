const blockedUsernameFragments = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'porn', 'sex', 'nude',
  'nazi', 'hitler', 'rape', 'rapist', 'whore', 'slut', 'faggot', 'nigger',
];

export function normalizedUsername(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[013457@$]/g, (character) => ({
      '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's',
    })[character] ?? character)
    .replace(/[^a-z0-9]/g, '');
}

export function usernameIsAllowed(value: string) {
  const normalized = normalizedUsername(value);
  return normalized.length >= 3 && normalized.length <= 24 &&
    !blockedUsernameFragments.some((fragment) => normalized.includes(fragment));
}
