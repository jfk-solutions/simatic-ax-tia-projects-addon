using ImageMagick;
using RtfDomParser;
using Siemens.Simatic.Hmi.Utah.Globalization;
using TiaFileFormat.Database.StorageTypes;
using TiaFileFormat.ExtensionMethods;
using TiaFileFormat.Helper;
using TiaFileFormat.Wrappers;
using TiaFileFormat.Wrappers.Images;

namespace TiaFileFormatServer.Classes.Helper
{
    public class ImagesIncludingFromRtfAndWmfAndEmfConverter : ImagesConverter
    {
        override public IHighLevelObject Convert(StorageBusinessObject storageBusinessObject, ConvertOptions convertOptions)
        {
            if (storageBusinessObject?.GetChild<HmiInternalImageAttributes>() != null)
            {
                var imgDataAttr = storageBusinessObject.GetChild<HmiInternalImageAttributes>();
                var imgData = imgDataAttr.GenuineContent.Data;

                if (RichTextFormatHelper.IsRtf(imgData.Span))
                {
                    using var tr = new StringReader(imgDataAttr.GenuineContent.DataAsString);
                    var d = new RTFDomDocument();
                    d.Load(tr);
                    var image = d.Elements.Traverse<RTFDomElement>(x => x.Elements).OfType<RTFDomImage>().FirstOrDefault();
                    if (image.PicType == RTFPicType.Wmetafile)
                    {
                        return new Image(storageBusinessObject) { Name = storageBusinessObject.ProcessedName, Data = image.Data, ImageType = ImageType.WMF };
                    }
                    else if (image.PicType == RTFPicType.Emfblip)
                    {
                        return new Image(storageBusinessObject) { Name = storageBusinessObject.ProcessedName, Data = image.Data, ImageType = ImageType.EMF };
                    }
                    else if (image.PicType == RTFPicType.Pngblip)
                    {
                        return new Image(storageBusinessObject) { Name = storageBusinessObject.ProcessedName, Data = image.Data, ImageType = ImageType.PNG };
                    }
                    else if (image.PicType == RTFPicType.Wbitmap)
                    {
                        return new Image(storageBusinessObject) { Name = storageBusinessObject.ProcessedName, Data = image.Data, ImageType = ImageType.BMP };
                    }
                }

                if (imgDataAttr.FileExtension == ".wmf" || imgDataAttr.FileExtension == ".emf")
                {
                    using var ms = new MemoryStream();
                    using var image = new MagickImage(imgData.ToArray());
                    image.Write(ms, MagickFormat.Svg);
                    ms.Position = 0;
                    return new Image(storageBusinessObject) { Name = storageBusinessObject.ProcessedName, Data = ms.ToArray(), ImageType = ImageType.SVG };
                }
            }
            return base.Convert(storageBusinessObject, convertOptions);
        }
    }
}
