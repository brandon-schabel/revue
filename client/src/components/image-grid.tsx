import { useState, useMemo, useEffect } from "react";

import { useFiles } from "../utils/hooks/api/use-files";
import type { ImageAnalysis, IndexedFileMetadata } from "../types/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Button } from "@ui/button";
import { useAnalyzeImage } from "../utils/hooks/api/use-analyze-image";
import { DialogHeader, Dialog, DialogTrigger, DialogContent, DialogTitle } from "@ui/dialog";

type SortOption = "name" | "path" | "format" | "size";
type Filters = {
    moods: string[];
    colors: string[];
    categories: string[];
    qualities: string[];
    // compositions: string[];
    subjects: string[];
    tags: string[];
    // uniqueFeatures: string[];
};


export const ImageGrid = () => {
    const { data: files, isLoading, error } = useFiles();
    const [sortBy, setSortBy] = useState<SortOption>("name");
    const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const analyzeImage = useAnalyzeImage();
    const [filters, setFilters] = useState<Filters>({
        moods: [],
        colors: [],
        categories: [],
        qualities: [],
        // compositions: [],
        subjects: [],
        tags: [],
        // uniqueFeatures: [],
    });
    const [selectedFilters, setSelectedFilters] = useState<Filters>({
        moods: [],
        colors: [],
        categories: [],
        qualities: [],
        // compositions: [],
        subjects: [],
        tags: [],
        // uniqueFeatures: [],
    });


    useEffect(() => {
        if (files) {
            const newFilters: Filters = {
                moods: [],
                colors: [],
                categories: [],
                qualities: [],
                // compositions: [],
                subjects: [],
                tags: [],
                // uniqueFeatures: [],
            };

            for (const file of files) {
                if (file.analysis) {
                    newFilters.moods.push(...file?.analysis?.mood || []);
                    newFilters.colors.push(...file?.analysis?.colors || []);
                    newFilters.categories.push(...file?.analysis?.categories|| []);
                    newFilters.qualities.push(file.analysis.quality);
                    // newFilters.compositions.push(file.analysis.composition);
                    newFilters.subjects.push(...file?.analysis?.subjects || []);
                    newFilters.tags.push(...file?.analysis?.tags || []);
                    // newFilters.uniqueFeatures.push(...file?.analysis?.uniqueFeatures || []);
                }
            }

            // Remove duplicates and sort
            for (const key of Object.keys(newFilters)) {
                newFilters[key as keyof Filters] = Array.from(new Set(newFilters[key as keyof Filters])).sort();
            }

            setFilters(newFilters);
        }
    }, [files]);


    const fileFormats = useMemo(() => {
        if (!files) return [];
        return Array.from(new Set(files.map(file => file.file_format)));
    }, [files]);

    const handleAnalyze = (imageId: number) => {
        analyzeImage.mutate(imageId);
    };

    const renderAnalysisData = (analysis: ImageAnalysis) => {
        return (
            <div className="space-y-2">
                <p><strong>Description:</strong> {analysis?.description}</p>
                <p><strong>Subjects:</strong> {analysis?.subjects?.join(", ")}</p>
                <p><strong>Colors:</strong> {analysis?.colors?.join(", ")}</p>
                <p><strong>Mood:</strong> {analysis?.mood?.join(", ")}</p>
                <p><strong>Composition:</strong> {analysis?.composition}</p>
                <p><strong>Text:</strong> {analysis?.text?.join("\n")}</p>
                <p><strong>Tags:</strong> {analysis?.tags?.join(", ")}</p>
                <p><strong>Categories:</strong> {analysis?.categories?.join(", ")}</p>
                <p><strong>Quality:</strong> {analysis?.quality}</p>
                <p><strong>Unique Features:</strong> {analysis?.uniqueFeatures?.join(", ")}</p>
            </div>
        );
    }


    const sortedAndFilteredFiles = useMemo(() => {
        if (!files) return [];

        let filteredFiles = files;

        // Apply format filter
        if (selectedFormats.length > 0) {
            filteredFiles = filteredFiles.filter(file => selectedFormats.includes(file.file_format));
        }

        // Apply search filter
        if (searchTerm) {
            const lowercasedSearch = searchTerm.toLowerCase();
            filteredFiles = filteredFiles.filter(file =>
                file.file_name.toLowerCase().includes(lowercasedSearch) ||
                file.file_path.toLowerCase().includes(lowercasedSearch) ||
                file.file_format.toLowerCase().includes(lowercasedSearch) ||
                file.date_created.toLowerCase().includes(lowercasedSearch) ||
                file.date_modified.toLowerCase().includes(lowercasedSearch)
            );
        }

        // Apply analysis filters
        for (const [key, values] of Object.entries(selectedFilters)) {
            if (values.length > 0) {
                filteredFiles = filteredFiles.filter(file => {
                    if (!file.analysis) return false;
                    return values.some(value =>
                        Array.isArray(file?.analysis?.[key as keyof ImageAnalysis])
                            ? (file.analysis[key as keyof ImageAnalysis] as string[]).includes(value)
                            : file?.analysis?.[key as keyof ImageAnalysis] === value
                    );
                });
            }
        }

        // Apply sorting
        return filteredFiles.sort((a, b) => {
            switch (sortBy) {
                case "name":
                    return a.file_name.localeCompare(b.file_name);
                case "path":
                    return a.file_path.localeCompare(b.file_path);
                case "format":
                    return a.file_format.localeCompare(b.file_format);
                case "size":
                    return a.file_size - b.file_size;
                default:
                    return 0;
            }
        });
    }, [files, sortBy, selectedFormats, searchTerm, selectedFilters]);

    if (isLoading) return <div>Loading...</div>;
    if (error) return <div>Error loading images</div>;

    return (
        <div>
            <div className="mb-4 flex flex-wrap gap-4">
                <Input
                    type="text"
                    placeholder="Search images..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-64"
                />
                <Select onValueChange={(value: SortOption) => setSortBy(value)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="path">Path</SelectItem>
                        <SelectItem value="format">Format</SelectItem>
                        <SelectItem value="size">Size</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2">
                    {fileFormats.map(format => (
                        <label key={format} className="flex items-center space-x-2">
                            <Checkbox
                                checked={selectedFormats.includes(format)}
                                onCheckedChange={(checked) => {
                                    setSelectedFormats(prev =>
                                        checked
                                            ? [...prev, format]
                                            : prev.filter(f => f !== format)
                                    );
                                }}
                            />
                            <span>{format}</span>
                        </label>
                    ))}
                </div>
            </div>
            <div className="mb-4">
                {Object.entries(filters).map(([category, items]) => (
                    <div key={category} className="mb-2">
                        <h3 className="font-bold capitalize">{category}</h3>
                        <div className="flex flex-wrap gap-2">
                            {items.map(item => (
                                <label key={item} className="flex items-center space-x-2">
                                    <Checkbox
                                        checked={selectedFilters[category as keyof Filters].includes(item)}
                                        onCheckedChange={(checked) => {
                                            setSelectedFilters(prev => ({
                                                ...prev,
                                                [category]: checked
                                                    ? [...prev[category as keyof Filters], item]
                                                    : prev[category as keyof Filters].filter(i => i !== item)
                                            }));
                                        }}
                                    />
                                    <span>{item}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedAndFilteredFiles.map((file: IndexedFileMetadata) => (
                    <Dialog key={file.file_path}>
                        <DialogTrigger asChild>
                            <div className="relative aspect-square cursor-pointer">
                                <img
                                    src={file.thumbnail_path}
                                    alt={file.file_name}
                                    className="object-cover w-full h-full rounded-lg"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-sm truncate">
                                    {file.file_name}
                                </div>
                                <Button
                                    className="absolute top-2 right-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleAnalyze(file.id);
                                    }}
                                    disabled={analyzeImage.isPending || !!file.analysis}
                                >
                                    {file.analysis ? "Analyzed" : "Analyze"}
                                </Button>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>{file.file_name}</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-4">
                                <img
                                    src={file.thumbnail_path}
                                    alt={file.file_name}
                                    className="w-full h-auto rounded-lg"
                                />
                                <div className="overflow-y-auto max-h-[60vh]">
                                    {file.analysis ? (
                                        renderAnalysisData(file.analysis)
                                    ) : (
                                        <p>No analysis data available.</p>
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                ))}
            </div>
        </div>
    );
};