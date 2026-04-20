//
//  AJPHelpers.swift
//  Airborne
//

import Foundation
import CryptoKit
import CommonCrypto

@objc public class AJPHelpers: NSObject {
    
    /// Computes the SHA256 hash of the given data and returns the hex digest.
    /// - Parameter data: The data to hash.
    /// - Returns: A 64-character lowercase hexadecimal string representing the SHA256 hash.
    @objc public static func sha256ForData(_ data: Data) -> String {
        if #available(iOS 13.0, *) {
            let digest = SHA256.hash(data: data)
            return digest.map { String(format: "%02x", $0) }.joined()
        } else {
            var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
            data.withUnsafeBytes { buffer in
                _ = CC_SHA256(buffer.baseAddress, CC_LONG(buffer.count), &digest)
            }
            return digest.map { String(format: "%02x", $0) }.joined()
        }
    }

    /// Encodes a string into a URL-safe format by escaping reserved characters.
    /// - Parameter string: The string to be URL encoded.
    /// - Returns: A URL-encoded string.
    @objc public static func urlEncodedStringFor(_ string: String) -> String {
        var output = ""
        let utf8 = Array(string.utf8)
        
        for char in utf8 {
            if char == 32 { // Space
                output += "+"
            } else if (char >= 97 && char <= 122) || // a-z
                      (char >= 65 && char <= 90)  || // A-Z
                      (char >= 48 && char <= 57)  || // 0-9
                      char == 46 || // .
                      char == 45 || // -
                      char == 95 || // _
                      char == 126 { // ~
                output += String(format: "%c", char)
            } else {
                output += String(format: "%%%02X", char)
            }
        }
        return output
    }
    
    /// Serializes a JSON-compatible dictionary or array into `Data`.
    /// - Parameter dict: The JSON object to serialize (e.g., `Dictionary` or `Array`).
    /// - Returns: The serialized JSON data, or an empty `Data` object if serialization fails or `nil` is provided.
    @objc public static func dataFromJSON(_ dict: Any?) -> Data {
        guard let dict = dict else {
            return Data()
        }
        
        do {
            let data = try JSONSerialization.data(withJSONObject: dict, options: [])
            return data.isEmpty ? Data() : data
        } catch {
            return Data()
        }
    }
}
