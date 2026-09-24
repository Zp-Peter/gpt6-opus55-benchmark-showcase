import AppKit
import AVFoundation
import CoreText
import CoreGraphics
import ImageIO

let width = 1280
let height = 720
let fps: Int32 = 30
let frames = 540
let duration = Double(frames) / Double(fps)
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let framesURL = root.appendingPathComponent("frames")
let posterURL = root.deletingLastPathComponent().appendingPathComponent("outputs/GPT-6-Sol-封面.png")
try? FileManager.default.createDirectory(at: framesURL,withIntermediateDirectories:true)

func clamp(_ x: Double) -> Double { max(0, min(1, x)) }
func smooth(_ x: Double) -> Double { let v=clamp(x); return v*v*(3-2*v) }
func ramp(_ t: Double, _ a: Double, _ b: Double) -> Double { smooth((t-a)/(b-a)) }
func pulse(_ t: Double, _ a: Double, _ b: Double, _ c: Double, _ d: Double) -> Double { ramp(t,a,b)*(1-ramp(t,c,d)) }
func color(_ r: Double, _ g: Double, _ b: Double, _ a: Double=1) -> CGColor { CGColor(red:r, green:g, blue:b, alpha:a) }
let white = color(0.94,0.97,0.98)
let muted = color(0.57,0.68,0.72)
let mint = color(0.49,0.94,0.83)
let gold = color(0.96,0.77,0.46)
let bg = color(0.025,0.045,0.065)

func rect(_ ctx: CGContext, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: CGColor, radius: CGFloat=0) {
  let r=CGRect(x:x,y:CGFloat(height)-y-h,width:w,height:h)
  ctx.setFillColor(fill)
  if radius > 0 { ctx.addPath(CGPath(roundedRect:r,cornerWidth:radius,cornerHeight:radius,transform:nil)); ctx.fillPath() }
  else { ctx.fill(r) }
}
func line(_ ctx: CGContext, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ stroke: CGColor, _ lw: CGFloat=1) {
  ctx.setStrokeColor(stroke); ctx.setLineWidth(lw); ctx.move(to:CGPoint(x:x1,y:CGFloat(height)-y1)); ctx.addLine(to:CGPoint(x:x2,y:CGFloat(height)-y2)); ctx.strokePath()
}
func circle(_ ctx: CGContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ fill: CGColor) {
  ctx.setFillColor(fill); ctx.fillEllipse(in:CGRect(x:x-r,y:CGFloat(height)-y-r,width:r*2,height:r*2))
}
func text(_ ctx: CGContext, _ s: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ fill: CGColor, _ weight: String="HelveticaNeue", centered: Bool=false, tracking: CGFloat=0) {
  let font=CTFontCreateWithName(weight as CFString,size,nil)
  let attrs: [NSAttributedString.Key:Any] = [.font:font,.foregroundColor:fill,NSAttributedString.Key(kCTKernAttributeName as String):tracking]
  let lineObj=CTLineCreateWithAttributedString(NSAttributedString(string:s,attributes:attrs))
  let bounds=CTLineGetBoundsWithOptions(lineObj,[])
  ctx.textMatrix = .identity
  ctx.textPosition=CGPoint(x:centered ? x-bounds.width/2 : x,y:CGFloat(height)-y)
  CTLineDraw(lineObj,ctx)
}
func ring(_ ctx: CGContext, _ x: CGFloat, _ y: CGFloat, _ r: CGFloat, _ alpha: Double, _ lw: CGFloat=1) {
  ctx.setStrokeColor(color(0.45,0.9,0.82,alpha)); ctx.setLineWidth(lw)
  ctx.strokeEllipse(in:CGRect(x:x-r,y:CGFloat(height)-y-r,width:2*r,height:2*r))
}
func base(_ ctx: CGContext, _ t: Double) {
  let space=CGColorSpaceCreateDeviceRGB()
  let grad=CGGradient(colorsSpace:space,colors:[bg,color(0.038,0.085,0.10),color(0.018,0.035,0.055)] as CFArray,locations:[0,0.5,1])!
  ctx.drawLinearGradient(grad,start:CGPoint(x:0,y:720),end:CGPoint(x:1280,y:0),options:[])
  for i in 0...16 { let y=CGFloat(i*45); line(ctx,0,y,1280,y,color(0.40,0.72,0.69,0.055)) }
  for i in 0...28 { let x=CGFloat(i*45); line(ctx,x,0,x,720,color(0.40,0.72,0.69,0.055)) }
  let offset=CGFloat(sin(t*0.4)*50)
  for i in 0..<5 { circle(ctx,1040+offset,170+CGFloat(i*18),CGFloat(85+i*33),color(0.22,0.68,0.59,0.008)) }
  rect(ctx,56,48,6,22,mint,radius:3)
  text(ctx,"GPT-6  /  SOL",74,66,18,white,"HelveticaNeue-Medium",tracking:2)
  text(ctx,"CONCEPT / 01",1176,65,12,muted,"HelveticaNeue-Medium",centered:true,tracking:2)
  rect(ctx,56,674,1168,1,color(0.50,0.77,0.75,0.23))
  rect(ctx,56,674,1168*CGFloat(t/duration),2,mint)
  text(ctx,"CREATE  ·  THINK  ·  BUILD",56,702,10,muted,"HelveticaNeue-Medium",tracking:2)
  text(ctx,String(format:"%02d:%02d",Int(t)/60,Int(t)%60),1224,702,10,muted,"HelveticaNeue-Medium",centered:true,tracking:1)
}
func scene1(_ ctx: CGContext, _ t: Double) {
  let a=pulse(t,0,0.6,3.0,3.7)
  let cx:CGFloat=640, cy:CGFloat=319
  for i in 0..<5 { ring(ctx,cx,cy,CGFloat(72+i*39)*CGFloat(ramp(t,0.1,2.4)),a*(0.24-Double(i)*0.03),1) }
  circle(ctx,cx,cy,CGFloat(6+8*ramp(t,0.3,1.1)),color(0.55,1,0.86,a))
  text(ctx,"一个想法",640,240,76,color(0.94,0.98,0.97,a),"PingFangSC-Semibold",centered:true,tracking:5)
  text(ctx,"从一个问题开始",640,428,25,color(0.63,0.79,0.78,a),"PingFangSC-Regular",centered:true,tracking:3)
}
func scene2(_ ctx: CGContext, _ t: Double) {
  let a=pulse(t,3.1,3.8,6.6,7.2)
  let slide=CGFloat((1-ramp(t,3.2,4.0))*80)
  text(ctx,"把问题说清楚。",110,210+slide,61,color(0.95,0.98,0.97,a),"PingFangSC-Semibold")
  text(ctx,"让思路接上下一步。",112,262+slide,24,color(0.61,0.78,0.77,a),"PingFangSC-Regular")
  rect(ctx,110,338+slide,1060,180,color(0.09,0.15,0.18,a*0.92),radius:20)
  rect(ctx,111,339+slide,1058,178,color(0.48,0.84,0.77,a*0.08),radius:20)
  circle(ctx,151,383+slide,5,color(0.48,0.94,0.83,a))
  text(ctx,"PROMPT",174,390+slide,14,color(0.50,0.80,0.75,a),"HelveticaNeue-Bold",tracking:3)
  let full="帮我把这个想法变成可执行的方案。"
  let count=min(full.count,max(0,Int((t-3.8)*9)))
  text(ctx,String(full.prefix(count)),151,456+slide,31,color(0.91,0.96,0.96,a),"PingFangSC-Regular")
  if t < 6.4 && Int(t*3)%2==0 { rect(ctx,151+CGFloat(count)*30,422+slide,2,39,color(0.49,0.94,0.83,a)) }
  text(ctx,"INPUT → DIRECTION",111,562+slide,13,color(0.54,0.74,0.72,a),"HelveticaNeue-Medium",tracking:3)
}
func iconCode(_ ctx: CGContext,_ x:CGFloat,_ y:CGFloat,_ a:Double) {
  line(ctx,x+10,y+29,x+30,y+48,color(0.55,0.95,0.84,a),4); line(ctx,x+30,y+48,x+10,y+67,color(0.55,0.95,0.84,a),4)
  line(ctx,x+78,y+29,x+58,y+48,color(0.55,0.95,0.84,a),4); line(ctx,x+58,y+48,x+78,y+67,color(0.55,0.95,0.84,a),4)
  line(ctx,x+51,y+21,x+38,y+74,color(0.96,0.77,0.46,a),4)
}
func scene3(_ ctx: CGContext, _ t: Double) {
  let a=pulse(t,6.8,7.4,11.5,12.1)
  text(ctx,"把思考，变成进展。",640,189,58,color(0.94,0.98,0.97,a),"PingFangSC-Semibold",centered:true)
  let labels=["写代码","理思路","解难题"]
  let english=["CODE","THINK","SOLVE"]
  for i in 0..<3 {
    let local=a*ramp(t,7.25+Double(i)*0.28,7.85+Double(i)*0.28)
    let x=CGFloat(111+i*363), yy=CGFloat(262+(1-local)*35)
    rect(ctx,x,yy,330,270,color(0.09,0.16,0.18,local),radius:20)
    rect(ctx,x,yy,330,2,color(0.49,0.94,0.83,local*0.8),radius:1)
    if i==0 { iconCode(ctx,x+120,yy+52,local) }
    if i==1 {
      for j in 0..<3 { circle(ctx,x+116+CGFloat(j*43),yy+97,8,color(j==1 ? 0.96:0.5,j==1 ? 0.77:0.94,j==1 ? 0.46:0.83,local)) }
      line(ctx,x+124,yy+97,x+151,yy+97,color(0.55,0.94,0.84,local),2)
      line(ctx,x+167,yy+97,x+194,yy+97,color(0.55,0.94,0.84,local),2)
    }
    if i==2 {
      ring(ctx,x+165,yy+97,41,local,2); line(ctx,x+144,yy+99,x+160,yy+114,color(0.55,0.94,0.84,local),4)
      line(ctx,x+160,yy+114,x+189,yy+78,color(0.55,0.94,0.84,local),4)
    }
    text(ctx,labels[i],x+34,yy+194,35,color(0.94,0.98,0.97,local),"PingFangSC-Semibold")
    text(ctx,english[i],x+35,yy+230,13,color(0.54,0.74,0.72,local),"HelveticaNeue-Medium",tracking:3)
  }
}
func scene4(_ ctx: CGContext, _ t: Double) {
  let a=pulse(t,11.7,12.2,14.4,15.1)
  let p=ramp(t,12,13.8)
  for i in 0..<9 {
    let yy:CGFloat=CGFloat(170+i*39)
    let x0:CGFloat=145
    let x1:CGFloat=640
    let stagger=Double(i)*0.06
    let pp=ramp(t,12+stagger,13.4+stagger)
    line(ctx,x0,yy,x0+(x1-x0)*CGFloat(pp),yy+(355-yy)*CGFloat(pp),color(0.47,0.91,0.82,a*(0.12+Double(i%3)*0.08)),1.5)
    circle(ctx,x0,yy,3,color(0.53,0.91,0.82,a*0.65))
  }
  for i in 0..<6 { ring(ctx,640,355,CGFloat(32+i*27)*CGFloat(p),a*(0.3-Double(i)*0.03),1) }
  circle(ctx,640,355,CGFloat(13+13*p),color(0.56,0.99,0.87,a))
  text(ctx,"让想法，继续向前。",640,548,52,color(0.95,0.98,0.97,a),"PingFangSC-Semibold",centered:true)
}
func scene5(_ ctx: CGContext, _ t: Double) {
  let a=ramp(t,14.7,15.5)
  let scale=CGFloat(1.0+0.03*(1-ramp(t,15.0,16.1)))
  for i in 0..<4 { ring(ctx,640,340,CGFloat(133+i*44)*scale,a*(0.15-Double(i)*0.025),1) }
  circle(ctx,640,340,7,color(0.50,0.93,0.82,a*0.75))
  text(ctx,"GPT-6",640,275,100,color(0.95,0.98,0.97,a),"HelveticaNeue-Bold",centered:true,tracking:1)
  text(ctx,"SOL",640,387,126,color(0.53,0.96,0.84,a),"HelveticaNeue-Light",centered:true,tracking:20)
  rect(ctx,533,422,214,2,color(0.94,0.77,0.47,a))
  text(ctx,"让想法，继续向前。",640,505,30,color(0.81,0.90,0.89,a),"PingFangSC-Regular",centered:true,tracking:3)
}
func draw(_ ctx: CGContext,_ t: Double) {
  base(ctx,t)
  if t<3.7 {scene1(ctx,t)}
  if t>=3.1 && t<7.2 {scene2(ctx,t)}
  if t>=6.8 && t<12.1 {scene3(ctx,t)}
  if t>=11.7 && t<15.1 {scene4(ctx,t)}
  if t>=14.7 {scene5(ctx,t)}
}

for n in 0..<frames {
  let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
  let t=Double(n)/Double(fps)
  draw(context,t)
  if let image=context.makeImage() {
    let destURL=framesURL.appendingPathComponent(String(format:"%04d.jpg",n))
    if let dest=CGImageDestinationCreateWithURL(destURL as CFURL,"public.jpeg" as CFString,1,nil) { CGImageDestinationAddImage(dest,image,[kCGImageDestinationLossyCompressionQuality:0.88] as CFDictionary);CGImageDestinationFinalize(dest) }
    if n==510,let dest=CGImageDestinationCreateWithURL(posterURL as CFURL,"public.png" as CFString,1,nil) { CGImageDestinationAddImage(dest,image,nil);CGImageDestinationFinalize(dest) }
  }
  if n%90==0 { print("rendered \(n)/\(frames)") }
}
print("FRAMES \(framesURL.path)")
