/**
 * Transform Utility Tests
 * Tests for snakeToCamel and escapeHtml functions
 */

const { snakeToCamel, escapeHtml, isValidSolanaAddress } = require('../src/utils/transform.js');

describe('Transform Utilities', () => {
  describe('snakeToCamel()', () => {
    it('should convert snake_case keys to camelCase', () => {
      const input = {
        user_name: 'john_doe',
        email_address: 'john@example.com',
        phone_number: '123-456-7890'
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        userName: 'john_doe',
        emailAddress: 'john@example.com',
        phoneNumber: '123-456-7890'
      });
    });

    it('should handle nested objects', () => {
      const input = {
        user_info: {
          first_name: 'John',
          last_name: 'Doe',
          contact_details: {
            email_address: 'john@example.com',
            phone_number: '123-456-7890'
          }
        }
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        userInfo: {
          firstName: 'John',
          lastName: 'Doe',
          contactDetails: {
            emailAddress: 'john@example.com',
            phoneNumber: '123-456-7890'
          }
        }
      });
    });

    it('should handle arrays', () => {
      const input = [
        { user_name: 'john', email_address: 'john@example.com' },
        { user_name: 'jane', email_address: 'jane@example.com' }
      ];

      const result = snakeToCamel(input);

      expect(result).toEqual([
        { userName: 'john', emailAddress: 'john@example.com' },
        { userName: 'jane', emailAddress: 'jane@example.com' }
      ]);
    });

    it('should handle nested arrays', () => {
      const input = {
        user_list: [
          { first_name: 'John', last_name: 'Doe' },
          { first_name: 'Jane', last_name: 'Smith' }
        ],
        meta_data: {
          total_count: 2
        }
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        userList: [
          { firstName: 'John', lastName: 'Doe' },
          { firstName: 'Jane', lastName: 'Smith' }
        ],
        metaData: {
          totalCount: 2
        }
      });
    });

    it('should handle null values', () => {
      const input = {
        user_name: null,
        email_address: 'test@example.com'
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        userName: null,
        emailAddress: 'test@example.com'
      });
    });

    it('should handle primitive values', () => {
      expect(snakeToCamel('string')).toBe('string');
      expect(snakeToCamel(123)).toBe(123);
      expect(snakeToCamel(true)).toBe(true);
      expect(snakeToCamel(null)).toBe(null);
      expect(snakeToCamel(undefined)).toBe(undefined);
    });
  });

  describe('escapeHtml()', () => {
    it('should escape & character', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape < character', () => {
      expect(escapeHtml('5 < 10')).toBe('5 &lt; 10');
    });

    it('should escape > character', () => {
      expect(escapeHtml('10 > 5')).toBe('10 &gt; 5');
    });

    it('should escape " character', () => {
      expect(escapeHtml('He said "Hello"')).toBe('He said &quot;Hello&quot;');
    });

    it("should escape ' character", () => {
      expect(escapeHtml("It's a test")).toBe('It&#039;s a test');
    });

    it('should escape all special characters', () => {
      const input = '<script>alert("XSS")</script>';
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should not modify safe strings', () => {
      const safe = 'Hello World 123';
      expect(escapeHtml(safe)).toBe(safe);
    });
  });

  describe('isValidSolanaAddress()', () => {
    it('should return true for valid Solana addresses', () => {
      // Valid 32-byte base58 encoded addresses
      expect(isValidSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')).toBe(true);
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(isValidSolanaAddress('')).toBe(false);
      expect(isValidSolanaAddress('not-a-valid-address')).toBe(false);
      expect(isValidSolanaAddress('too-short')).toBe(false);
    });

    it('should return false for non-base58 strings', () => {
      expect(isValidSolanaAddress('!!!@@@###')).toBe(false);
      expect(isValidSolanaAddress('0OIl')).toBe(false); // Invalid base58 chars
    });

    it('should return false for wrong length', () => {
      // Too short (not 32 bytes when decoded)
      expect(isValidSolanaAddress('1')).toBe(false);
      // Too long
      expect(isValidSolanaAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsUextra')).toBe(false);
    });
  });
});
