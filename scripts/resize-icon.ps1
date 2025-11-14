Add-Type -AssemblyName System.Drawing
$source = "assets/icons/icon-128.png"
$destination = "assets/icons/icon-128.png"
$img = [System.Drawing.Image]::FromFile($source)
$bitmap = New-Object System.Drawing.Bitmap 128, 128
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.DrawImage($img, 0, 0, 128, 128)
$graphics.Dispose()
$img.Dispose()
$bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Dispose()
