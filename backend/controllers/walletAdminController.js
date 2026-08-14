const walletService = require('../services/walletService');

const getConfig = async (req, res) => {
  try {
    res.json(await walletService.getConfig());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateConfig = async (req, res) => {
  try {
    res.json(await walletService.updateConfig(req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getOrganizationWallet = async (req, res) => {
  try {
    const { orgId } = req.params;
    const [wallet, history] = await Promise.all([
      walletService.getOrCreateWallet(orgId),
      walletService.listTransactions(orgId, { page: req.query.page, limit: req.query.limit }),
    ]);
    res.json({ balance: wallet.balance, ...history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const grantCredits = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const result = await walletService.grantAdminCredit(
      req.params.orgId,
      amount,
      reason,
      req.superAdmin?._id
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { getConfig, updateConfig, getOrganizationWallet, grantCredits };
