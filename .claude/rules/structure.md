# Structure conventions

## File structure
- When creating utility or library functions, move as many functions that contextually make sense into one single file. For example everything manipulating text should be in text.ts
- Components that are scoped to one page.tsx live in a `_components` folder in the same directory
- Specific but reusable components that are used across multiple pages live in the `src/app/_components` folder (i.e. certain cards, dialogs, modals, etc)
- Global components (like buttons, modals etc.) live in the `src/components` folder

## File names
- Use kebab-case for .ts and .tsx files

## Component structure
- When creating new react components structure it as follows
  1. useState hooks
  2. useRef hooks
  2. Other non-react native or hooks that require more logic like `useForm`, `useQuery` or `useRouter`
  3. useEffects and other utility functions
  4. Event handlers
  5. Any dynamically created constants `isLoading`, `isError` etc.
  6. Return statement
- Any constants should live above the respective components
