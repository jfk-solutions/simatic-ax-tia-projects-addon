using DotNetSiemensPLCToolBoxLibrary.DataTypes.Blocks.Step5;
using DotNetSiemensPLCToolBoxLibrary.DataTypes.Blocks.Step7V5;
using DotNetSiemensPLCToolBoxLibrary.DataTypes.Projectfolders;
using DotNetSiemensPLCToolBoxLibrary.DataTypes.Projectfolders.Step5;
using DotNetSiemensPLCToolBoxLibrary.DataTypes.Projectfolders.Step7V5;
using DotNetSiemensPLCToolBoxLibrary.Projectfiles;
using Microsoft.AspNetCore.Mvc;
using S7CommPlusDriver;
using Siemens.Simatic.Hmi.Utah.Globalization;
using System.Text.Json;
using TiaFileFormat;
using TiaFileFormat.Database;
using TiaFileFormat.Database.StorageTypes;
using TiaFileFormat.S7CommPlus;
using TiaFileFormat.Wrappers;
using TiaFileFormat.Wrappers.CodeBlocks;
using TiaFileFormat.Wrappers.Controller.Tags;
using TiaFileFormat.Wrappers.Controller.WatchTable;
using TiaFileFormat.Wrappers.Converters.AutomationXml;
using TiaFileFormat.Wrappers.Converters.Code;
using TiaFileFormat.Wrappers.Hmi.Tags;
using TiaFileFormat.Wrappers.Hmi.WinCCAdvanced;
using TiaFileFormat.Wrappers.Hmi.WinCCUnified;
using TiaFileFormat.Wrappers.Images;
using TiaFileFormatServer.Classes.Api.Request;
using TiaFileFormatServer.Classes.Api.Response;
using TiaFileFormatServer.Classes.Helper;

public class Program
{
    static HighLevelObjectConverterWrapper highLevelObjectConverterWrapper;
    static ConvertOptions convertOptions;

    static System.Runtime.Caching.MemoryCache _projectCache = new System.Runtime.Caching.MemoryCache("TiaProjectCache");

    private static void Main(string[] args)
    {
        highLevelObjectConverterWrapper = new HighLevelObjectConverterWrapper(new ImagesIncludingFromRtfAndWmfAndEmfConverter());
        convertOptions = new ConvertOptions();

        var builder = WebApplication.CreateBuilder();
        var app = builder.Build();

        app.MapPost("/openProject", ([FromBody] ProjectReference project) =>
        {
            OpenProject(project.File);
            return "ok";
        });

        app.MapPost("/closeProject", ([FromBody] ProjectReference project) =>
        {
            _projectCache.Remove(project.File);
            GC.Collect();
            return "ok";
        });

        app.MapPost("/getFolders", ([FromBody] ProjectReference project) =>
        {
            var loadedProject = OpenProject(project.File);
            var fr = new FolderResult() { Folders = new List<Folder>() };
            if (loadedProject is TiaDatabaseFile database)
            {
                if (database.RootObject.StoreObjectIds.TryGetValue("Project", out var prj))
                    fr.Folders.AddRange(BuildFoldersTia((StorageBusinessObject)prj.StorageObject));
                if (database.RootObject.StoreObjectIds.TryGetValue("Library", out var lb))
                    fr.Folders.AddRange(BuildFoldersTia((StorageBusinessObject)lb.StorageObject));
                var imgs = database.FindStorageBusinessObjectsWithChildType<HmiInternalImageAttributes>();
                if (imgs.Any())
                {
                    var imgsNode = new Folder() { Name = "Images", Children = imgs.Select(x => new Folder() { Name = x.ProcessedName, Id = x.Header.StoreObjectId.InstId, }).ToList() };
                    fr.Folders.Add(imgsNode);
                }
            }
            else if (loadedProject is Project step5_7Project)
            {
                fr.Folders.AddRange(BuildFoldersStep5_7(step5_7Project.ProjectStructure));
            }
            return fr;
        });

        app.MapPost("/getItem", ([FromBody] ItemReference item) =>
        {
            var loadedProject = OpenProject(item.File);
            if (loadedProject is TiaDatabaseFile database)
            {
                if (database.StorageObjectDictionary.TryGetValue(item.Id, out var so))
                {
                    var sb = so as StorageBusinessObject;
                    var res = new ItemResult() { Name = sb.ProcessedName };

                    var highLevelObject = highLevelObjectConverterWrapper.Convert(sb, convertOptions);
                    if (highLevelObject != null)
                    {
                        switch (highLevelObject)
                        {
                            case Image image:
                                {
                                    res.ItemType = (ItemType)Enum.Parse(typeof(ItemType), image.ImageType.ToString(), true);
                                    res.Data = image.Data;
                                    res.Name = image.Name;
                                    return res;
                                }
                            case PlcTagTable plcTagTable:
                                {
                                    res.ItemType = ItemType.CSV;
                                    res.Name += "(" + item.Additional + ")";
                                    if (item.Additional == "Tags")
                                        res.StringData = CsvSerializer.ToCsv(plcTagTable.Tags);
                                    else if (item.Additional == "Constants")
                                        res.StringData = CsvSerializer.ToCsv(plcTagTable.UserConstants);
                                    return res;
                                }
                            case HmiTagTable hmiTagTable:
                                {
                                    res.ItemType = ItemType.CSV;
                                    res.StringData = CsvSerializer.ToCsv(hmiTagTable.Tags);
                                    return res;
                                }
                            case WatchTable watchTable:
                                {
                                    res.ItemType = ItemType.CSV;
                                    res.StringData = CsvSerializer.ToCsv(watchTable.Items);
                                    return res;
                                }
                            case WinCCUnifiedScreen winCCUnifiedScreen:
                                {
                                    if (item.Additional == "Script")
                                    {
                                        res.ItemType = ItemType.Javascript;
                                        res.StringData = winCCUnifiedScreen.GetScriptString();
                                    }
                                    else
                                    {
                                        res.ItemType = ItemType.HTML;
                                        res.StringData = winCCUnifiedScreen.Html;
                                    }
                                    return res;
                                }
                            case WinCCScreen winCCScreen:
                                {
                                    if (item.Additional == "Script")
                                    {
                                        res.ItemType = ItemType.VBScript;
                                        res.StringData = winCCScreen.GetScriptString();
                                    }
                                    else
                                    {
                                        res.ItemType = ItemType.HTML;
                                        res.StringData = winCCScreen.Html;
                                    }
                                    return res;
                                }
                            case WinCCScript winCCScript:
                                {
                                    res.ItemType = winCCScript.ScriptLang switch
                                    {
                                        TiaFileFormat.Wrappers.Hmi.ScriptLang.VB => ItemType.VBScript,
                                        TiaFileFormat.Wrappers.Hmi.ScriptLang.C => ItemType.CScript,
                                        TiaFileFormat.Wrappers.Hmi.ScriptLang.Javascript => ItemType.Javascript,
                                    };
                                    res.StringData = winCCScript.Script;
                                    return res;
                                }
                            case BaseBlock baseBlock:
                                {
                                    if (baseBlock is CodeBlock codeBlock && codeBlock.BlockLang == BlockLang.SCL)
                                    {
                                        res.ItemType = ItemType.SclSource;
                                        res.StringData = string.Join("", codeBlock.ToCodeNetworks());
                                        res.Name = codeBlock.Name;
                                        return res;
                                    }
                                    else if (baseBlock is CodeBlock codeBlock2 && codeBlock2.BlockLang == BlockLang.STL)
                                    {
                                        res.ItemType = ItemType.StlSource;
                                        res.StringData = string.Join("### Network ###", codeBlock2.ToCodeNetworks(new CodeBlockToSourceBlockConverter.ConvertOptions() { Mnemonik = Mnemonic.German }));
                                        res.Name = codeBlock2.Name;
                                        return res;
                                    }
                                    res.ItemType = ItemType.XML;
                                    res.StringData = baseBlock.ToAutomationXml();
                                    res.Name = baseBlock.Name;
                                    return res;
                                }
                            case TiaFileFormat.Wrappers.TextLists.TextList textList:
                                {
                                    res.ItemType = ItemType.JSON;
                                    res.StringData = JsonSerializer.Serialize(textList, new JsonSerializerOptions() { WriteIndented = true });
                                    res.Name = textList.Name;
                                    return res;
                                }
                            case TiaFileFormat.Wrappers.Controller.Alarms.AlarmList alarmList:
                                {
                                    res.ItemType = ItemType.JSON;
                                    res.StringData = JsonSerializer.Serialize(alarmList, new JsonSerializerOptions() { WriteIndented = true });
                                    res.Name = alarmList.Name;
                                    return res;
                                }
                            case TiaFileFormat.Wrappers.Hmi.Alarms.HmiAlarmList hmiAlarmList:
                                {
                                    res.ItemType = ItemType.JSON;
                                    res.StringData = JsonSerializer.Serialize(hmiAlarmList, new JsonSerializerOptions() { WriteIndented = true });
                                    res.Name = hmiAlarmList.Name;
                                    return res;
                                }
                            case TiaFileFormat.Wrappers.CfCharts.CfChart cfChart:
                                {
                                    res.ItemType = ItemType.JSON;
                                    res.StringData = JsonSerializer.Serialize(cfChart, new JsonSerializerOptions() { WriteIndented = true });
                                    res.Name = cfChart.Name;
                                    return res;
                                }
                            case TiaFileFormat.Wrappers.UserManagement.User user:
                                {
                                    res.ItemType = ItemType.JSON;
                                    res.StringData = JsonSerializer.Serialize(user, new JsonSerializerOptions() { WriteIndented = true });
                                    res.Name = user.Name;
                                    return res;
                                }
                        }
                    }
                }
            }
            return new ItemResult();
        });

        app.MapPost("/online/connect", ([FromBody] OnlineCpuReference cpu) =>
        {
            ConnectCpu(cpu);
            return "ok";
        });

        app.MapPost("/online/disconnect", ([FromBody] OnlineCpuReference cpu) =>
        {
            var key = GetCacheKey(cpu);
            var cacheEntry = _projectCache.Get(cpu.Ip);
            if (cacheEntry != null)
            {
                ((S7CommPlusConnection)cacheEntry).Disconnect();
            }
            _projectCache.Remove(key);
            return "ok";
        });

        app.MapPost("/online/getItem", ([FromBody] OnlineItemReference item) =>
        {
            var conn = ConnectCpu(item);
            var codeBlockWrapper = OnlineBlockConverter.GetOnlineCodeBlock(conn, (uint)item.Id);
            var res = new ItemResult() { Name = codeBlockWrapper.Name };

            if (codeBlockWrapper.BlockLang == BlockLang.SCL)
            {
                res.ItemType = ItemType.SclSource;
                res.StringData = string.Join("", codeBlockWrapper.ToCodeNetworks());
                res.Name = codeBlockWrapper.Name;
                return res;
            }
            else if (codeBlockWrapper.BlockLang == BlockLang.STL)
            {
                res.ItemType = ItemType.StlSource;
                res.StringData = string.Join("### Network ###", codeBlockWrapper.ToCodeNetworks(new CodeBlockToSourceBlockConverter.ConvertOptions() { Mnemonik = Mnemonic.German }));
                res.Name = codeBlockWrapper.Name;
                return res;
            }
            res.ItemType = ItemType.XML;
            res.StringData = codeBlockWrapper.ToAutomationXml();
            res.Name = codeBlockWrapper.Name;
            return res;
        });

        app.MapPost("/online/getFolders", ([FromBody] OnlineCpuReference cpu) =>
        {
            var conn = ConnectCpu(cpu);
            var resBlk = conn.BrowseAllBlocks(out var brws);
            if (resBlk == 0)
            {
                var fr = new FolderResult(); // { Folders = new List<Folder>() };

                var items = brws.GroupBy(x => x.type).Select(x =>
                        new Folder()
                        {
                            Name = x.Key.ToString() + "s",
                            Children = x.GroupBy(x => x.lang).Select(y =>
                                new Folder()
                                {
                                    Name = y.Key.ToString(),
                                    Children = y.Select(z => new Folder() { Name = z.name + " (" + z.number + ")", Id = z.db_block_relid /* BlockInfo = z, OnlineCpuReference = cpu */ }).OrderBy(a => a.Name).ToList()
                                }).ToList()
                        });
                //var items = brws.Select(x => new OnlineTreeItem() { Name = x.name + " [" + x.type + ", " + x.lang + "] ", BlockInfo = x });
                fr.Folders = items.ToList();
                //fr.Folders.Add(fileTvItem);
                return fr;
            }
            return null;
        });

        app.Run(args[0]);
    }

    static IEnumerable<Folder> BuildFoldersTia(StorageBusinessObject sb)
    {
        var fld = new Folder() { Name = sb.ProcessedName, Id = sb.Header?.StoreObjectId?.InstId ?? 0 };
        if (PlcTagTableConverter.IsConvertableObject(sb))
        {
            fld.Children = new List<Folder>();
            fld.Children.Add(new Folder() { Name = "Constants", Id = sb.Header.StoreObjectId.InstId, Additional = "Constants" });
            fld.Children.Add(new Folder() { Name = "Tags", Id = sb.Header.StoreObjectId.InstId, Additional = "Tags" });
        }
        else if (PlcTagTableConverter.IsConvertableObject(sb))
        {
            fld.Children = new List<Folder>();
            fld.Children.Add(new Folder() { Name = "Constants", Id = sb.Header.StoreObjectId.InstId, Additional = "Constants" });
            fld.Children.Add(new Folder() { Name = "Tags", Id = sb.Header.StoreObjectId.InstId, Additional = "Tags" });
        }
        else if (WinCCAdvancedScreenConverter.IsConvertableObject(sb) || WinCCUnifiedScreenConverter.IsConvertableObject(sb))
        {
            fld.Children = new List<Folder>();
            fld.Children.Add(new Folder() { Name = "Html", Id = sb.Header.StoreObjectId.InstId, Additional = "Html" });
            fld.Children.Add(new Folder() { Name = "Script", Id = sb.Header.StoreObjectId.InstId, Additional = "Script" });
        }
        else if (sb.ProjectTreeChildren.Any())
        {
            fld.Children = new List<Folder>();
            foreach (var child in sb.ProjectTreeChildren)
            {
                if (UnsupportedFolderTypes.ListSubTypes.Contains(child.CoreAttributes?.Subtype))
                    continue;
                foreach (var flattenedNode in BuildFoldersTia(child))
                {
                    fld.Children.Add(flattenedNode);
                }
            }
        }

        if (sb.TiaTypeName== "Siemens.Simatic.Hmi.Utah.Device.HmiDeviceData")
        {
            if (fld.Children == null)
                fld.Children = new List<Folder>();
            var textListFld = new Folder() { Name = "TextLists", Id = sb.Header.StoreObjectId.InstId };
            fld.Children.Add(textListFld);
            var textLists = sb.GetRelationsWithNameResolved("Siemens.Simatic.Hmi.Utah.TextAndGraphicLists.HmiTextListData.HmiTextListDataChildren");
            textListFld.Children = textLists.Select(x => BuildFoldersTia(x).First()).ToList();

            var graphicListFld = new Folder() { Name = "GraphicLists", Id = sb.Header.StoreObjectId.InstId };
            fld.Children.Add(graphicListFld);
            var graphicList = sb.GetRelationsWithNameResolved("Siemens.Simatic.Hmi.Utah.Device.HmiDeviceData.HmiGraphicListDataChildren");
            graphicListFld.Children = graphicList.Select(x => BuildFoldersTia(x).First()).ToList();
        }
        yield return fld;
    }

    static IEnumerable<Folder> BuildFoldersStep5_7(ProjectFolder projectFolder)
    {
        var fld = new Folder() { Name = projectFolder.Name, Children = new List<Folder>() };

        if (projectFolder is BlocksOfflineFolder blkOfflineFld)
        {
            var ret = blkOfflineFld.BlockInfos
                .OfType<S7ProjectBlockInfo>()
                .GroupBy(x => x.BlockType)
                .Select(x => new Folder()
                {
                    Name = x.Key.ToString(),
                    Children = x.Select(y => new Folder()
                    {
                        //ProjectBlockInfo = y,
                        Name = y.BlockName + (y.Name == null ? "" : " (" + y.Name + ")")
                    }).ToList()
                });
            fld.Children = ret.ToList();
        }
        else if (projectFolder is Step5BlocksFolder step5BlocksFolder)
        {
            var ret = step5BlocksFolder.BlockInfos
                .OfType<S5ProjectBlockInfo>()
                .GroupBy(x => x.BlockType)
                .Select(x => new Folder()
                {
                    Name = x.Key.ToString(),
                    Children = x.Select(y => new Folder()
                    {
                        //ProjectBlockInfo = y,
                        Name = y.BlockName + (y.Name == null ? "" : " (" + y.Name + ")")
                    }).ToList()
                });
            fld.Children = ret.ToList();
        }
        else
        {
            foreach (var child in projectFolder.SubItems)
            {
                foreach (var flattenedNode in BuildFoldersStep5_7(child))
                {
                    fld.Children.Add(flattenedNode);
                }
            }
        }

        yield return fld;
    }

    static object OpenProject(string file)
    {
        if (OperatingSystem.IsWindows() && file.StartsWith("/"))
            file = file.Substring(1);
        var cacheEntry = _projectCache.Get(file);
        if (cacheEntry != null)
        {
            return cacheEntry;
        }


        Project step5_7Project = null;
        try
        {
            step5_7Project = Projects.LoadProject(file, showDeleted: false); //, chkShowDeleted.Checked, credentials
        }
        catch { }

        if (step5_7Project != null)
        {
            _projectCache.Add(new System.Runtime.Caching.CacheItem(file, step5_7Project), new System.Runtime.Caching.CacheItemPolicy() { SlidingExpiration = TimeSpan.FromMinutes(10) });
            return step5_7Project;
        }
        else
        {
            var tfp = TiaFileProvider.CreateFromSingleFile(file);
            var database = TiaDatabaseFile.Load(tfp);
            _projectCache.Add(new System.Runtime.Caching.CacheItem(file, database), new System.Runtime.Caching.CacheItemPolicy() { SlidingExpiration = TimeSpan.FromMinutes(10) });
            return database;
        }
    }

    static string GetCacheKey(OnlineCpuReference cpu)
    {
        return "ONLINE_" + cpu.Ip + "_" + cpu.Port;
    }

    static S7CommPlusConnection ConnectCpu(OnlineCpuReference cpu)
    {
        var key = GetCacheKey(cpu);
        var cacheEntry = _projectCache.Get(cpu.Ip);
        if (cacheEntry != null)
            return (S7CommPlusConnection)cacheEntry;

        var conn = new S7CommPlusConnection();
        var res = conn.Connect(cpu.Ip, cpu.Password, cpu.Username, 30000);

        return conn;
    }
}