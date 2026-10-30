$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$iconPath=Join-Path (Split-Path -Parent $PSScriptRoot) 'assets/app-icon.ico'
$frames=@()
foreach($size in @(16,24,32,48,64,128,256)){
 $bitmap=[Drawing.Bitmap]::new($size,$size)
 $graphics=[Drawing.Graphics]::FromImage($bitmap)
 $graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
 $graphics.ScaleTransform($size/256.0,$size/256.0)
 $graphics.Clear([Drawing.Color]::Transparent)
 $background=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#101b27'))
 $path=[Drawing.Drawing2D.GraphicsPath]::new()
 foreach($arc in @(@(0,0,96,96,180),@(160,0,96,96,270),@(160,160,96,96,0),@(0,160,96,96,90))){$path.AddArc($arc[0],$arc[1],$arc[2],$arc[3],$arc[4],90)}
 $path.CloseFigure();$graphics.FillPath($background,$path)
 $cyan=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#20d9ed'),12)
 $cyan.LineJoin=[Drawing.Drawing2D.LineJoin]::Round;$cyan.StartCap='Round';$cyan.EndCap='Round'
 $points=[Drawing.PointF[]]@([Drawing.PointF]::new(128,35),[Drawing.PointF]::new(221,91),[Drawing.PointF]::new(128,147),[Drawing.PointF]::new(35,91))
 $fill=[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#153d50'));$graphics.FillPolygon($fill,$points);$graphics.DrawPolygon($cyan,$points)
 foreach($y in @(126,161)){$graphics.DrawLines($cyan,[Drawing.PointF[]]@([Drawing.PointF]::new(40,$y),[Drawing.PointF]::new(128,($y+53)),[Drawing.PointF]::new(216,$y)))}
 $white=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#e5fbff'),12);$white.StartCap='Round';$white.EndCap='Round';$white.LineJoin='Round'
 $graphics.DrawLines($white,[Drawing.PointF[]]@([Drawing.PointF]::new(93,89),[Drawing.PointF]::new(117,104),[Drawing.PointF]::new(162,76)))
 $stream=[IO.MemoryStream]::new();$bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
 $frames+=,@{Size=$size;Bytes=$stream.ToArray()}
 $stream.Dispose();$white.Dispose();$cyan.Dispose();$path.Dispose();$fill.Dispose();$background.Dispose();$graphics.Dispose();$bitmap.Dispose()
}
$writer=[IO.BinaryWriter]::new([IO.File]::Create($iconPath))
try{
 $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$frames.Count)
 $offset=6+16*$frames.Count
 foreach($frame in $frames){$dimension=if($frame.Size -eq 256){0}else{$frame.Size};$writer.Write([byte]$dimension);$writer.Write([byte]$dimension);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$frame.Bytes.Length);$writer.Write([uint32]$offset);$offset+=$frame.Bytes.Length}
 foreach($frame in $frames){$writer.Write([byte[]]$frame.Bytes)}
}finally{$writer.Dispose()}
Write-Output $iconPath
