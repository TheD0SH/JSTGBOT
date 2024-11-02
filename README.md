# Telegram Crypto Balance Bot

This repository contains a Node.js application that serves as a Telegram bot to track wallet balances for Ethereum and related networks. The bot interacts with the Blockscout APIs to retrieve the latest balance information and displays it to users upon request. The bot can handle multiple commands for adding individual or bulk wallets, fetching balance reports, and more.

## Features
- **Start Command (`/start`)**: Provides a welcome message and lists the available commands.
- **Add Wallet (`/addwallet`)**: Adds a single wallet to the balance tracking list. The user needs to provide the wallet address and a name.
- **Add Bulk Wallets (`/addbulk`)**: Adds multiple wallets in bulk. Addresses and names can be separated by tabs or new lines.
- **Check Balances (`/balances`)**: Fetches the latest balance report for all added wallets and returns the combined value in ETH, USD, and CAD.
- **View Logs (`/logs`)**: Allows the user to view activity logs for debugging and audit purposes.

## Installation

### Prerequisites
- Node.js (version 14 or higher)
- npm
- A valid Telegram bot token

### Setup
1. Clone the repository:
   ```sh
   git clone <repository_url>
   cd <repository_directory>
   ```

2. Install dependencies:
   ```sh
   npm install
   ```

3. Create a `.env` file in the root directory and add your Telegram bot token:
   ```env
   TELEGRAM_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
   PORT=3000
   ```

4. Start the application locally:
   ```sh
   node index.js
   ```
   The application will run on `http://localhost:3000` by default.

## Commands
- `/start`: Provides information about how to use the bot.
- `/addwallet`: Add a wallet address and name for tracking, e.g.:
  ```
  /addwallet 0xYourWalletAddress WalletName
  ```
- `/addbulk`: Add multiple wallet addresses and names at once. For example:
  ```
  wallet 1	0xAddress1
  wallet 2	0xAddress2
  ```
  or
  ```
  0xAddress1 wallet 1
  0xAddress2 wallet 2
  ```
- `/balances`: Retrieve the balance report for all added wallets. The bot will calculate an estimated time for balance fetching before processing the request.
- `/logs`: View activity logs (admin only).

## Environment Variables
The application uses the following environment variables:
- `TELEGRAM_TOKEN`: The Telegram bot token used for authentication.
- `PORT`: The port on which the Express server will run (default is 3000).

## API Integrations
- **Currency Exchange Rate API**: The bot uses the CurrencyFreaks API to get the current exchange rate between USD and CAD.
- **Blockscout API**: The bot uses multiple Blockscout API endpoints to get the balance of wallet addresses on Ethereum, Base, Arbitrum, Optimism, Gnosis, Polygon, and others.

## Usage
- Start a chat with the Telegram bot by searching for it using its name in the Telegram app.
- Send `/start` to the bot to see the list of available commands.
- Use `/addwallet` to add an individual wallet or `/addbulk` to add multiple wallets at once.
- Use `/balances` to get a report of all wallets added to the bot.

## Notes
- **Polling**: The bot uses polling to receive updates from Telegram.
- **Estimated Balance Calculation Time**: The bot estimates the time it will take to calculate balances based on the number of wallet addresses added (8 seconds per wallet).

## License
This project is open source and available under the [MIT License](LICENSE).

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## Troubleshooting
- Ensure you have a valid Telegram bot token in your `.env` file.
- Make sure the environment variables are correctly set before running the application.
- Check the `/logs` endpoint for any errors or issues that might occur.

## Contact
If you have any questions or need further assistance, please feel free to reach out or submit an issue on GitHub.

