const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * RefreshToken model for managing JWT refresh tokens
 * Implements token rotation security pattern
 */
const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  token: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  previous_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Previous token in rotation chain, allows one-time use of expired tokens'
  },
  family_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Groups tokens from same session for revocation on suspected theft'
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  revoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  revoked_reason: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Reason for revocation: expired, manual, rotation, suspected_theft'
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'refresh_tokens',
  timestamps: false,
  indexes: [
    {
      name: 'idx_refresh_tokens_user_id',
      fields: ['user_id']
    },
    {
      name: 'idx_refresh_tokens_family_id',
      fields: ['family_id']
    },
    {
      name: 'idx_refresh_tokens_expires_at',
      fields: ['expires_at']
    },
    {
      name: 'idx_refresh_tokens_revoked',
      fields: ['revoked']
    },
    {
      name: 'idx_refresh_tokens_token',
      fields: ['token'],
      unique: true
    },
    {
      name: 'idx_refresh_tokens_previous_token',
      fields: ['previous_token']
    }
  ]
});

/**
 * Create a new refresh token
 * @param {Object} data Token data
 * @returns {Promise<Object>} Created token
 */
RefreshToken.createToken = async function(data) {
  return await this.create(data);
};

/**
 * Find token by value
 * @param {string} token Token value
 * @returns {Promise<Object|null>} Token or null
 */
RefreshToken.findByToken = async function(token) {
  return await this.findOne({ where: { token } });
};

/**
 * Find valid token (not expired, not revoked)
 * @param {string} token Token value
 * @returns {Promise<Object|null>} Token or null
 */
RefreshToken.findValidToken = async function(token) {
  return await this.findOne({
    where: {
      token,
      revoked: false,
      expires_at: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    }
  });
};

/**
 * Find token by previous token (for rotation)
 * @param {string} previousToken Previous token value
 * @returns {Promise<Object|null>} Token or null
 */
RefreshToken.findByPreviousToken = async function(previousToken) {
  return await this.findOne({ 
    where: { 
      previous_token: previousToken,
      revoked: false,
      expires_at: {
        [sequelize.Sequelize.Op.gt]: new Date()
      }
    } 
  });
};

/**
 * Revoke all tokens in a family
 * @param {string} familyId Family ID
 * @param {string} reason Reason for revocation
 * @returns {Promise<number>} Number of tokens revoked
 */
RefreshToken.revokeFamily = async function(familyId, reason = 'suspected_theft') {
  return await this.update(
    { 
      revoked: true,
      revoked_reason: reason
    },
    { 
      where: { family_id: familyId } 
    }
  );
};

/**
 * Clean up expired tokens
 * @returns {Promise<number>} Number of tokens deleted
 */
RefreshToken.cleanupExpired = async function() {
  // Mark expired tokens as revoked
  await this.update(
    { 
      revoked: true,
      revoked_reason: 'expired'
    },
    { 
      where: {
        expires_at: {
          [sequelize.Sequelize.Op.lt]: new Date()
        },
        revoked: false
      }
    }
  );
  
  // Delete tokens that have been expired for more than 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  
  return await this.destroy({
    where: {
      expires_at: {
        [sequelize.Sequelize.Op.lt]: cutoff
      }
    }
  });
};

module.exports = RefreshToken;
