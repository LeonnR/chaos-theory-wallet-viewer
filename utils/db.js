// Simple in-memory database with persistence simulation
// In a production app, this would be replaced with a real database like MongoDB

/**
 * In-memory database collections
 */
const collections = {
  tags: [], // Address tags
};

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Tag collection operations
 */
export const TagsDB = {
  /**
   * Find all tags for a specific wallet
   * @param {string} walletAddress - Wallet address that created the tags
   * @returns {Array} Array of tags
   */
  findByWallet: (walletAddress) => {
    return collections.tags.filter(tag => 
      tag.createdBy.toLowerCase() === walletAddress.toLowerCase()
    );
  },
  
  /**
   * Create a new tag
   * @param {object} tag - Tag object
   * @returns {object} Created tag with ID
   */
  create: (tag) => {
    const newTag = {
      ...tag,
      id: generateId(),
      createdAt: Math.floor(Date.now() / 1000)
    };
    
    collections.tags.push(newTag);
    return newTag;
  },
  
  /**
   * Delete a tag
   * @param {string} id - Tag ID
   * @param {string} walletAddress - Wallet address that created the tag
   * @returns {boolean} Success status
   */
  deleteById: (id, walletAddress) => {
    const initialLength = collections.tags.length;
    
    collections.tags = collections.tags.filter(tag => 
      tag.id !== id || tag.createdBy.toLowerCase() !== walletAddress.toLowerCase()
    );
    
    return collections.tags.length !== initialLength;
  },
  
  /**
   * Find a tag by ID
   * @param {string} id - Tag ID
   * @returns {object|null} Tag object or null if not found
   */
  findById: (id) => {
    return collections.tags.find(tag => tag.id === id) || null;
  }
};

/**
 * Initialize database with seed data (for testing)
 */
export function initDatabase() {
  // Add some example tags for testing
  if (collections.tags.length === 0) {
    collections.tags.push({
      id: 'example-tag-1',
      address: '0x1234567890123456789012345678901234567890',
      tag: 'Exchange',
      createdBy: '0x0000000000000000000000000000000000000000',
      createdAt: Math.floor(Date.now() / 1000)
    });
  }
}

// Initialize the database
initDatabase(); 