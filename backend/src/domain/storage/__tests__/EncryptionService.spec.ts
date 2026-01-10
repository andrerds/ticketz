import * as fc from 'fast-check';
import { EncryptionService } from '../EncryptionService';
import crypto from 'crypto';

describe('EncryptionService', () => {
  const generateMasterKey = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  describe('Property 3: Credential encryption', () => {
    it('should encrypt and decrypt any string back to the original value', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (plaintext) => {
            const masterKey = generateMasterKey();
            const encrypted = EncryptionService.encrypt(plaintext, masterKey);
            const decrypted = EncryptionService.decrypt(encrypted, masterKey);
            
            expect(decrypted).toBe(plaintext);
            expect(encrypted).not.toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different ciphertext for the same plaintext on multiple encryptions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (plaintext) => {
            const masterKey = generateMasterKey();
            const encrypted1 = EncryptionService.encrypt(plaintext, masterKey);
            const encrypted2 = EncryptionService.encrypt(plaintext, masterKey);
            
            expect(encrypted1).not.toBe(encrypted2);
            
            const decrypted1 = EncryptionService.decrypt(encrypted1, masterKey);
            const decrypted2 = EncryptionService.decrypt(encrypted2, masterKey);
            
            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid master key formats', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.length !== 64),
          fc.string({ minLength: 1, maxLength: 100 }),
          (invalidKey, plaintext) => {
            expect(() => {
              EncryptionService.encrypt(plaintext, invalidKey);
            }).toThrow('Master key must be 64 hex characters (32 bytes)');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject decryption with wrong master key', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (plaintext) => {
            const masterKey1 = generateMasterKey();
            const masterKey2 = generateMasterKey();
            
            const encrypted = EncryptionService.encrypt(plaintext, masterKey1);
            
            expect(() => {
              EncryptionService.decrypt(encrypted, masterKey2);
            }).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject malformed encrypted text', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.includes(':')),
          (malformedText) => {
            const masterKey = generateMasterKey();
            
            expect(() => {
              EncryptionService.decrypt(malformedText, masterKey);
            }).toThrow('Invalid encrypted text format');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit tests for edge cases', () => {
    it('should handle empty strings', () => {
      const masterKey = generateMasterKey();
      const encrypted = EncryptionService.encrypt('', masterKey);
      const decrypted = EncryptionService.decrypt(encrypted, masterKey);
      
      expect(decrypted).toBe('');
    });

    it('should handle special characters and unicode', () => {
      const masterKey = generateMasterKey();
      const specialText = '🔐 Secret: !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const encrypted = EncryptionService.encrypt(specialText, masterKey);
      const decrypted = EncryptionService.decrypt(encrypted, masterKey);
      
      expect(decrypted).toBe(specialText);
    });

    it('should handle very long strings', () => {
      const masterKey = generateMasterKey();
      const longText = 'a'.repeat(10000);
      const encrypted = EncryptionService.encrypt(longText, masterKey);
      const decrypted = EncryptionService.decrypt(encrypted, masterKey);
      
      expect(decrypted).toBe(longText);
    });
  });
});
