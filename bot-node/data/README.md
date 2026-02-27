# Data Folder

This folder contains all data files used by the Queridômetro bot.

## Files

### Active Data Files
- `placar.json` - Score tracking for all participants
- `grupos.json` - Cached WhatsApp groups information
- `mensagens.json` - Active voting messages tracking
- `poll.json` - Poll/voting message IDs with participant names
- `reacoes.json` - Reactions cache for the current day
- `users.json` - Group users information (JIDs and names)
- `mensagem-cache.json` - Message cache with mentions for reaction tracking

### Example Files
- `*.example.json` - Template files showing the structure of each data file

## Notes

- All JSON files in this folder (except `*.example.json`) are ignored by git
- These files are automatically created and managed by the bot
- To reset all data, you can safely delete the JSON files (not the examples)
- The bot will recreate them with default/empty values on next start
