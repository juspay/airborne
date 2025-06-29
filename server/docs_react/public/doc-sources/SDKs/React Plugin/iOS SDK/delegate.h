@objc public protocol AirborneDelegate {
   
  @objc optional func namespace() -> String
   
  @objc optional func bundlePath() -> String
   
  @objc optional func dimensions() -> [String: String]
   
  @objc optional func onBootComplete() -> Void
   
  @objc optional func onEvent() -> Void
}