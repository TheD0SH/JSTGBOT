// Import necessary modules
const express = require('express');
const axios = require('axios');
dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');
const NodeCache = require('node-cache');
const Bottleneck = require('bottleneck');

// Load environment variables from .env file
dotenv.config();

// Express app setup
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Telegram Bot Token
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const URL = process.env.URL;

// Create a Telegram bot instance without polling
const bot = new TelegramBot(TELEGRAM_TOKEN);

// Set up the webhook with the Telegram API
axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook`, {
  url: `${URL}/bot${TELEGRAM_TOKEN}`
})
.then((response) => {
  console.log("Webhook set successfully:", response.data);
})
.catch((error) => {
  console.error("Error setting webhook:", error.message);
});

// Handle incoming webhook updates
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
  console.log("Incoming webhook received:", req.body); // Debug log to verify webhook receipt
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// In-memory storage for wallet addresses and logs
const addresses = {};
const logs = [];
const cache = new NodeCache({ stdTTL: 300 }); // Cache with 5 minutes TTL

// Create a limiter to throttle requests
const limiter = new Bottleneck({
  minTime: 100, // 100ms between requests to keep within 10 RPS
  maxConcurrent: 1,
});

// Function to get CAD exchange rate
const getCadExchangeRate = async () => {
  try {
    const response = await axios.get("https://api.currencyfreaks.com/v2.0/rates/latest?apikey=04b50b2b36b74a10849e152572e95483");
    if (response.status === 200 && response.data.rates && response.data.rates.CAD) {
      const cadExchangeRate = parseFloat(response.data.rates.CAD);
      logs.push(`Current CAD Exchange Rate: 1 USD = ${cadExchangeRate.toFixed(2)} CAD`);
      return cadExchangeRate;
    }
  } catch (error) {
    logs.push(`Failed to fetch CAD exchange rate: ${error.message}`);
  }
  return 0;
};

let cadExchangeRate = 0;
getCadExchangeRate().then((rate) => {
  cadExchangeRate = rate;
});

let ethPriceUsd = 0;

// Updated function to get ETH price in USD
const getEthPriceInUsd = async () => {
  try {
    const response = await axios.get("https://eth.blockscout.com/api/v2/stats");
    if (response.status === 200 && response.data && response.data.coin_price) {
      ethPriceUsd = parseFloat(response.data.coin_price);
      logs.push(`Current ETH Price in USD: $${ethPriceUsd.toFixed(2)}`);
      console.log(`Current ETH Price in USD: $${ethPriceUsd.toFixed(2)}`);
    }
  } catch (error) {
    logs.push(`Failed to fetch ETH price in USD: ${error.message}`);
    console.error(`Failed to fetch ETH price in USD: ${error.message}`);
  }
};

getEthPriceInUsd();

let waitingForWalletInfo = false;
let chatIdForWallet = null;

// Command handler for starting the bot
bot.onText(/\/start/, (msg) => {
  console.log("Received /start command from Telegram"); // Extra debug log to verify handler is triggered
  const chatId = msg.chat.id;
  const startMessage = "Welcome to the Crypto Balance Bot!\n\nCommands you can use:\n" +
                       "/addwallet - Add a new wallet. Format: <address> <name>\n" +
                       "/addbulk - Add wallets in bulk. Format: <address> <name> pairs separated by tabs or new lines\n" +
                       "/balances - Get the latest balance report of all added wallets\n" +
                       "/logs - View activity logs (admin only).";
  bot.sendMessage(chatId, startMessage);
  logs.push("Start command received and replied successfully");
});

// Command handler for adding a wallet
bot.onText(/\/addwallet/, (msg) => {
  chatIdForWallet = msg.chat.id;
  bot.sendMessage(chatIdForWallet, "Please provide the wallet address and name in the format: <address> <name>");
  logs.push("Add wallet request message sent");
  waitingForWalletInfo = true;
});

// Command handler for adding wallets in bulk
bot.onText(/\/addbulk/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Please provide the wallet address and name pairs, separated by tabs or new lines.");
  waitingForWalletInfo = true;
  chatIdForWallet = chatId;
  logs.push("Add bulk wallets request message sent");
});

// Handle wallet input only when requested
bot.on('message', (msg) => {
  if (!waitingForWalletInfo || msg.chat.id !== chatIdForWallet) {
    return; // If not waiting for a wallet or the message is from a different chat, ignore it
  }

  const text = msg.text;

  if (text.includes('\t') || text.includes('\n')) {
    // Handle bulk wallet addition
    const lines = text.split(/\n|\t/);
    lines.forEach(line => {
      const [address, ...nameParts] = line.trim().split(/\s+/);
      const name = nameParts.join(' ').trim();
      if (address.startsWith('0x') && address.length === 42) {
        addresses[address.toLowerCase()] = name;
        logs.push(`Bulk added wallet ${name} with address ${address}`);
        console.log(`Bulk added wallet ${name} with address ${address}`);
      } else {
        logs.push(`Invalid address format provided in bulk: ${line}`);
        console.warn(`Invalid address format provided in bulk: ${line}`);
      }
    });
    bot.sendMessage(chatIdForWallet, `Bulk wallets have been added successfully.`);
    waitingForWalletInfo = false;
    chatIdForWallet = null;
  } else if (text && text.startsWith('0x') && text.match(/^0x[a-fA-F0-9]{40}\s+.+$/)) {
    // Handle single wallet addition
    const [address, ...nameParts] = text.split(' ');
    const name = nameParts.join(' ').trim();
    if (address.startsWith('0x') && address.length === 42) {
      addresses[address.toLowerCase()] = name;
      bot.sendMessage(chatIdForWallet, `Wallet ${name} with address ${address} has been added successfully.`);
      logs.push(`Wallet ${name} added successfully`);
      console.log(`Wallet ${name} with address ${address} has been added successfully.`);
      waitingForWalletInfo = false; // Reset after handling wallet info
      chatIdForWallet = null;
    } else {
      bot.sendMessage(chatIdForWallet, "Invalid address format. Please make sure it starts with '0x'.");
      logs.push("Invalid address format provided");
      console.warn("Invalid address format provided");
    }
  } else {
    bot.sendMessage(chatIdForWallet, "Invalid input format. Please use the format: <address> <name>");
    logs.push("Invalid input format provided");
    console.warn("Invalid input format provided");
  }
});

// Command handler for checking balances
bot.onText(/\/balances/, async (msg) => {
  const chatId = msg.chat.id;
  const numberOfAddresses = Object.keys(addresses).length;
  const estimatedTime = numberOfAddresses * 2;
  bot.sendMessage(chatId, `Calculating Balance:👩‍💻 est. ${estimatedTime} seconds 👩‍💻`);

  logs.push("Balances command received");
  console.log("Balances command received");
  const balanceReport = await fetchWalletBalances();
  bot.sendMessage(chatId, balanceReport);
  logs.push("Balances report sent successfully");
  console.log("Balances report sent successfully");
});

// Enhanced logging for Telegram bot setup
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.code}, ${error.message}`);
});

bot.on('webhook_error', (error) => {
  console.error(`Webhook error: ${error.message}`);
});

bot.on('error', (error) => {
  console.error(`General error from Telegram bot: ${error.message}`, error);
});

// Log when bot starts successfully
console.log(`Bot is set up with webhook for updates`);

// Function to fetch wallet balances
const fetchWalletBalances = async () => {
  if (Object.keys(addresses).length === 0) {
    logs.push("No wallet addresses available for balance checking.");
    console.log("No wallet addresses available for balance checking.");
    return "No wallet addresses available for balance checking.";
  }

  const baseUrls = [
    {
      "url": "https://eth.blockscout.com/api?module=account&action=balancemulti&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "results"
    },
    {
      "url": "https://base.blockscout.com/api?module=account&action=balancemulti&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "results"
    },
    {
      "url": "https://arbitrum.blockscout.com/api?module=account&action=balancemulti&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "results"
    },
    {
      "url": "https://optimism.blockscout.com/api?module=account&action=balancemulti&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "results"
    },
    {
      "url": "https://gnosis.blockscout.com/api?module=account&action=tokenbalance&contractaddress=0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "gnosis"
    },
    {
      "url": "https://polygon.blockscout.com/api?module=account&action=tokenbalance&contractaddress=0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "polygon"
    },
    {
      "url": "https://eth.blockscout.com/api?module=account&action=tokenbalance&contractaddress=0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "eth"
    },
    {
      "url": "https://eth.blockscout.com/api?module=account&action=tokenbalance&contractaddress=0xac3E018457B222d93114458476f3E3416Abbe38F&address={}&apikey=f81c68cb-34fb-4ae8-b79b-3f2d72a0f308",
      "type": "eth"
    }
  ];

  let totalBalance = {};
  let totalETH = 0;

  for (let address in addresses) {
    totalBalance[address.toLowerCase()] = 0;
  }

  for (let baseUrlInfo of baseUrls) {
    for (let address of Object.keys(addresses)) {
      try {
        const urlWithAddress = baseUrlInfo.url.replace("{}", address);
        console.log(`Making API call to: ${urlWithAddress}`);
        const response = await limiter.schedule(() => axios.get(urlWithAddress));
        console.log(`API response from ${urlWithAddress}:`, JSON.stringify(response.data, null, 2));

        if (response.status === 200 && response.data && response.data.result) {
          totalETH = updateBalances(response.data.result, [address], totalBalance, totalETH, baseUrlInfo);
        } else {
          logs.push(`Invalid or empty response from ${urlWithAddress}`);
          console.error(`Invalid or empty response from ${urlWithAddress}`);
        }
      } catch (error) {
        logs.push(`Failed to fetch data for address ${address} from ${baseUrlInfo.url}: ${error.message}`);
        console.error(`Failed to fetch data for address ${address} from ${baseUrlInfo.url}: ${error.message}`);
      }
    }
  }

  let totalCombinedBalance = Object.values(totalBalance).reduce((acc, balance) => acc + balance, 0);
  console.log(`Total combined balance: ${totalCombinedBalance}`);
  let totalValueUsd = totalCombinedBalance * ethPriceUsd;
  console.log(`Total value in USD: ${totalValueUsd}`);
  let totalValueCad = totalValueUsd * cadExchangeRate;
  console.log(`Total value in CAD: ${totalValueCad}`);

  let balanceReport = "\nTotal Balances per Address:\n";
  for (let address in addresses) {
    balanceReport += `${addresses[address]}: ${totalBalance[address.toLowerCase()].toFixed(6)}\n`;
  }
  balanceReport += `\nTotal ETH: ${totalETH.toFixed(6)}\n`;
  balanceReport += `Total combined balance in USD: $${totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  balanceReport += `Total combined balance in CAD: $${totalValueCad.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;

  return balanceReport;
};

// Helper function to update balances
const updateBalances = (result, chunk, totalBalance, totalETH, baseUrlInfo) => {
  if (typeof result === 'string') {
    // Handle case where result is a string (single token balance)
    const balance = parseFloat(result) / (10 ** 18);
    chunk.forEach(address => {
      totalBalance[address.toLowerCase()] += balance;
      totalETH += balance;
      logs.push(`Converted balance for ${address} from ${baseUrlInfo.type}: ${balance}`);
      console.log(`Converted balance for ${address} from ${baseUrlInfo.type}: ${balance}`);
    });
  } else if (Array.isArray(result)) {
    // Handle case where result is an array (multiple balances)
    result.forEach(entry => {
      const balance = parseFloat(entry.balance) / (10 ** 18);
      const address = entry.account ? entry.account.toLowerCase() : entry.address.toLowerCase();
      if (balance === 0) {
        logs.push(`No balance for ${baseUrlInfo.type} token at address ${address}`);
        console.log(`No balance for ${baseUrlInfo.type} token at address ${address}`);
      } else {
        totalBalance[address] += balance;
        totalETH += balance;
        logs.push(`Converted balance for ${address} from ${baseUrlInfo.type}: ${balance}`);
        console.log(`Converted balance for ${address} from ${baseUrlInfo.type}: ${balance}`);
      }
    });
  } else {
    logs.push(`Unexpected response structure`);
    console.error(`Unexpected response structure`);
  }
  return totalETH;
};

// Helper function to chunk array into smaller arrays
const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

// Endpoint to display logs
app.get('/logs', (req, res) => {
  res.send(`<pre>${logs.join('<br>')}</pre>`);
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Welcome to the Telegram Bot Server');
});

// Remove local server start for Vercel compatibility
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

// Vercel export
module.exports = app;
