//
//  AJPCryptoHelper.swift
//  Airborne
//
//  Created by Balaganesh S on 23/09/25.
//

import Foundation
import CommonCrypto

@objc public class AJPCryptoHelper: NSObject {
    
    @objc public static func sha256(forData data: Data) -> String {
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        
        data.withUnsafeBytes { bytes in
            _ = CC_SHA256(bytes.bindMemory(to: UInt8.self).baseAddress, CC_LONG(data.count), &digest)
        }
        
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
