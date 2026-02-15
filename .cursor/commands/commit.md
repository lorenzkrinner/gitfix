# Create github commit

1. Run `git diff` to retrieve all changes
2. Generate a 40-80 chars long commit message
4. Output the message to the chat

Rules:
- If the changse are really complex (i.e. structure changes, large scale refactoring) you can make them longer but use bullet points to structure the message
- Do not include redundand info (i.e. exports, renamings, etc.)
- Prefix with either `refactor:`, `feat:`, `fix:`, `docs:`, or `chore` depending on the changes
- Do not commit anything. Just output the commit message.