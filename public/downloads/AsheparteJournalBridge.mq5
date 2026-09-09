#property copyright "Asheparte AI"
#property link      "https://asheparte-ai.vercel.app/"
#property version   "1.00"
#property strict
#property description "Read-only MT5/ACCM journal bridge. This EA never opens, modifies or closes trades."

input string InpProvider       = "ACCM";
input string InpBridgeEndpoint = "https://asheparte-ai.vercel.app/api/mt5/ingest";
input string InpBridgeToken    = "";
input int    InpSyncSeconds    = 60;
input int    InpInitialDays    = 30;
input int    InpMaxDeals       = 250;

string g_time_key;
string g_ticket_key;

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   StringReplace(value, "\r", "\\r");
   StringReplace(value, "\n", "\\n");
   StringReplace(value, "\t", "\\t");
   return value;
}

string JsonString(const string value)
{
   return "\"" + JsonEscape(value) + "\"";
}

bool IsJournalDeal(const ENUM_DEAL_TYPE deal_type)
{
   return deal_type == DEAL_TYPE_BUY ||
          deal_type == DEAL_TYPE_SELL ||
          deal_type == DEAL_TYPE_BALANCE ||
          deal_type == DEAL_TYPE_CREDIT ||
          deal_type == DEAL_TYPE_CHARGE ||
          deal_type == DEAL_TYPE_CORRECTION ||
          deal_type == DEAL_TYPE_BONUS ||
          deal_type == DEAL_TYPE_COMMISSION ||
          deal_type == DEAL_TYPE_COMMISSION_DAILY ||
          deal_type == DEAL_TYPE_COMMISSION_MONTHLY ||
          deal_type == DEAL_TYPE_COMMISSION_AGENT_DAILY ||
          deal_type == DEAL_TYPE_COMMISSION_AGENT_MONTHLY ||
          deal_type == DEAL_TYPE_INTEREST;
}

string DealJson(const ulong ticket)
{
   const ulong order_ticket = (ulong)HistoryDealGetInteger(ticket, DEAL_ORDER);
   const ulong position_id  = (ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
   const long time_msc       = HistoryDealGetInteger(ticket, DEAL_TIME_MSC);
   const long deal_type      = HistoryDealGetInteger(ticket, DEAL_TYPE);
   const long deal_entry     = HistoryDealGetInteger(ticket, DEAL_ENTRY);
   const string symbol       = HistoryDealGetString(ticket, DEAL_SYMBOL);
   const string comment      = HistoryDealGetString(ticket, DEAL_COMMENT);
   const double volume       = HistoryDealGetDouble(ticket, DEAL_VOLUME);
   const double price        = HistoryDealGetDouble(ticket, DEAL_PRICE);
   const double commission   = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
   const double swap         = HistoryDealGetDouble(ticket, DEAL_SWAP);
   const double fee          = HistoryDealGetDouble(ticket, DEAL_FEE);
   const double profit       = HistoryDealGetDouble(ticket, DEAL_PROFIT);

   return StringFormat(
      "{\"ticket\":%I64u,\"orderTicket\":%I64u,\"positionId\":%I64u,\"timeMsc\":%I64d,\"type\":%d,\"entry\":%d,\"symbol\":%s,\"volume\":%.8f,\"price\":%.8f,\"commission\":%.8f,\"swap\":%.8f,\"fee\":%.8f,\"profit\":%.8f,\"comment\":%s}",
      ticket,
      order_ticket,
      position_id,
      time_msc,
      (int)deal_type,
      (int)deal_entry,
      JsonString(symbol),
      volume,
      price,
      commission,
      swap,
      fee,
      profit,
      JsonString(comment)
   );
}

bool PostPayload(const string payload)
{
   char request_data[];
   char response_data[];
   string response_headers;
   StringToCharArray(payload, request_data, 0, WHOLE_ARRAY, CP_UTF8);
   if(ArraySize(request_data) > 0)
      ArrayResize(request_data, ArraySize(request_data) - 1);

   const string headers =
      "Content-Type: application/json\r\n" +
      "X-Asheparte-Bridge-Token: " + InpBridgeToken + "\r\n" +
      "X-Asheparte-Bridge-Version: 1.00\r\n";

   ResetLastError();
   const int status = WebRequest("POST", InpBridgeEndpoint, headers, 15000, request_data, response_data, response_headers);
   if(status == -1)
   {
      Print("Asheparte Journal: WebRequest failed. Error ", GetLastError(),
            ". Add https://asheparte-ai.vercel.app to Tools > Options > Expert Advisors > Allow WebRequest.");
      return false;
   }

   const string response = CharArrayToString(response_data, 0, WHOLE_ARRAY, CP_UTF8);
   if(status < 200 || status >= 300)
   {
      Print("Asheparte Journal: server returned HTTP ", status, ": ", response);
      return false;
   }

   Print("Asheparte Journal: account snapshot synchronized. HTTP ", status);
   return true;
}

void SynchronizeJournal()
{
   if(StringLen(InpBridgeToken) < 32)
   {
      Print("Asheparte Journal: paste the 32+ character bridge token from the website settings.");
      return;
   }

   const long login = AccountInfoInteger(ACCOUNT_LOGIN);
   const string server = AccountInfoString(ACCOUNT_SERVER);
   const string company = AccountInfoString(ACCOUNT_COMPANY);
   const string currency = AccountInfoString(ACCOUNT_CURRENCY);
   const long trade_mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   const double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   const double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   const double margin = AccountInfoDouble(ACCOUNT_MARGIN);
   const double margin_free = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   const double floating_profit = AccountInfoDouble(ACCOUNT_PROFIT);

   long last_time_msc = GlobalVariableCheck(g_time_key) ? (long)GlobalVariableGet(g_time_key) : 0;
   ulong last_ticket = GlobalVariableCheck(g_ticket_key) ? (ulong)GlobalVariableGet(g_ticket_key) : 0;
   const datetime now = TimeCurrent();
   const datetime history_from = last_time_msc > 0
      ? (datetime)MathMax(0, last_time_msc / 1000 - 1)
      : now - (datetime)(MathMax(1, InpInitialDays) * 86400);

   if(!HistorySelect(history_from, now))
   {
      Print("Asheparte Journal: HistorySelect failed. Error ", GetLastError());
      return;
   }

   const int total = HistoryDealsTotal();
   const int safe_limit = MathMax(1, MathMin(1000, InpMaxDeals));
   const int first = MathMax(0, total - safe_limit);
   string deals_json = "[";
   bool needs_comma = false;
   long newest_time_msc = last_time_msc;
   ulong newest_ticket = last_ticket;

   for(int index = first; index < total; index++)
   {
      const ulong ticket = HistoryDealGetTicket(index);
      if(ticket == 0)
         continue;

      const long deal_time_msc = HistoryDealGetInteger(ticket, DEAL_TIME_MSC);
      const ENUM_DEAL_TYPE deal_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
      const bool already_sent = deal_time_msc < last_time_msc ||
                                (deal_time_msc == last_time_msc && ticket <= last_ticket);
      if(already_sent || !IsJournalDeal(deal_type))
         continue;

      if(needs_comma)
         deals_json += ",";
      deals_json += DealJson(ticket);
      needs_comma = true;

      if(deal_time_msc > newest_time_msc || (deal_time_msc == newest_time_msc && ticket > newest_ticket))
      {
         newest_time_msc = deal_time_msc;
         newest_ticket = ticket;
      }
   }
   deals_json += "]";

   const string payload = StringFormat(
      "{\"provider\":%s,\"account\":{\"login\":%I64d,\"server\":%s,\"company\":%s,\"currency\":%s,\"tradeMode\":%d,\"balance\":%.8f,\"equity\":%.8f,\"margin\":%.8f,\"freeMargin\":%.8f,\"floatingProfit\":%.8f,\"observedAt\":%I64d},\"deals\":%s}",
      JsonString(InpProvider),
      login,
      JsonString(server),
      JsonString(company),
      JsonString(currency),
      (int)trade_mode,
      balance,
      equity,
      margin,
      margin_free,
      floating_profit,
      (long)TimeGMT() * 1000,
      deals_json
   );

   if(PostPayload(payload) && newest_time_msc > last_time_msc)
   {
      GlobalVariableSet(g_time_key, (double)newest_time_msc);
      GlobalVariableSet(g_ticket_key, (double)newest_ticket);
   }
}

int OnInit()
{
   const long login = AccountInfoInteger(ACCOUNT_LOGIN);
   g_time_key = "AsheparteJournalTime_" + IntegerToString(login);
   g_ticket_key = "AsheparteJournalTicket_" + IntegerToString(login);
   EventSetTimer(MathMax(15, InpSyncSeconds));
   Print("Asheparte Journal Bridge loaded in READ-ONLY mode. It contains no trade functions.");
   SynchronizeJournal();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   SynchronizeJournal();
}

void OnTick()
{
   // Intentionally empty: journal synchronization runs on a timer only.
}
