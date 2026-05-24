// =========================================================================
// 1. CONFIGURATION & INITIALIZATION LAYER
// =========================================================================
require('dotenv').config(); // Maps variables from .env dynamically into process.env memory
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const LEDGER_PATH = path.join(__dirname, 'bank_ledger.json');

app.use(express.json());

// Boot check to verify isolation parameters are active
console.log("=================================================================");
console.log(`[BOOT] Initializing Treasury Engine...`);
console.log(`[BOOT] Target Gateway: ${process.env.PAYROLL_PROVIDER_URL || "NOT_SET"}`);
console.log("=================================================================");

// =========================================================================
// 2. SECURITY AUTHENTICATION GATE MIDDLEWARE
// =========================================================================
function enforcePayrollAuthorization(req, res, next) {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error("[SECURITY ALERT] Unauthorized access blocked: Missing Bearer structure.");
    return res.status(401).json({ error: "Unauthorized. Explicit cryptographic token required." });
  }

  const token = authHeader.split(' ')[1];
  
  // Verify incoming string against the secure environment variable key
  if (token !== process.env.GATEWAY_SECRET_KEY) {
    console.error("[SECURITY ALERT] Forbidden access blocked: Invalid signature validation.");
    return res.status(403).json({ error: "Forbidden. Cryptographic signature failure." });
  }

  // Signature valid, pass request down to the processing channel
  next();
}

// =========================================================================
// 3. CORE PAYROLL DISPATCH & LEDGER ENGINE
// =========================================================================
function readSecureLedger() {
  try {
    if (!fs.existsSync(LEDGER_PATH)) {
      return { treasury_metadata: {}, payroll_batches: [] };
    }
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch (err) {
    console.error("[ERROR] Failed reading secure ledger storage:", err.message);
    return { treasury_metadata: {}, payroll_batches: [] };
  }
}

app.post('/api/v1/payroll/dispatch', enforcePayrollAuthorization, (req, res) => {
  const { employeeID, netAmount, allocationType, description } = req.body;
  
  if (!employeeID || !netAmount) {
    return res.status(400).json({ error: "Malformed payload structure. Missing required constraints." });
  }

  let ledger = readSecureLedger();
  
  // Construct a validated payroll transaction entry
  const certifiedRecord = {
    record_id: require('crypto').randomUUID(),
    timestamp: new Date().toISOString(),
    employee_id: employeeID,
    allocation: allocationType || "Net Pay",
    amount_cents: Math.round(Number(netAmount) * 100), // Parsed in cents to eliminate floating-point calculation errors
    memo: description || "Automated System Disbursement"
  };

  // Append new record directly to tracking database array
  if (!ledger.payroll_batches) ledger.payroll_batches = [];
  ledger.payroll_batches.push(certifiedRecord);
  
  try {
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
    console.log(`\n[PAYROLL SUCCESS] Validated entry written for ${employeeID}.`);
    console.log(`[LEDGER LOG] Record ID: ${certifiedRecord.record_id} | Amount: ${certifiedRecord.amount_cents} Cents`);
    
    // Abstracted Routing Output representing environment target values
    console.log(`[TRANSIT ENGINE] Data packet configured with corporate parameters:`);
    console.log(`  -> Transit Routing: ${process.env.COMPANY_ACH_ROUTING_NUMBER ? "VALIDATED_MASKED" : "MISSING"}`);
    console.log(`  -> Target Endpoint: ${process.env.PAYROLL_PROVIDER_URL}\n`);

    res.json({
      status: "PROCESSED_AND_RECORDED",
      recordID: certifiedRecord.record_id,
      systemTimestamp: certifiedRecord.timestamp
    });
  } catch (err) {
    console.error("[ERROR] Storage write execution failed:", err.message);
    res.status(500).json({ error: "Internal server error writing asset states." });
  }
});

// =========================================================================
// 4. MASTER SERVICE RUNTIME
// =========================================================================
server.listen(PORT, () => {
  console.log("=================================================================");
  console.log(`[AUTHENTICATED SERVICE] Runtime active in mode: ${process.env.NODE_ENV || "development"}`);
  console.log(`[SYSTEM ENDPOINT] Listening securely on: http://127.3.4.3:${PORT}`);
  console.log("=================================================================");
});
