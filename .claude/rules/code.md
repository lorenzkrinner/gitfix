# Rules for writing code

## Naming conventions
- Use PascalCase for component names
- Use camelCase for functions
- Use PascalCase for types
- Constants in SCREAMING_SNAKE_CASE
- For page.tsx names, give components the name of the page (like DashboardPage, SettingsPage, etc.)

## Comments
- Do not use comments to explain what the code does for low level stuff (e.g. "creating a Set to dedupe" or "using useMemo to memoize the result of a function")
- Instead use comments to explain why you did something or if it is not immediately clear (e.g. "also possible to do Y but we did X", "this is a workaround for the following issue")
- Do not use emojies in comments and logs