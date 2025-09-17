import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChevronRight } from "lucide-react";
import Header from "./components/Header";
import "./index.css";

interface Content {
  type: "code" | "image";
  filename: string;
  content: string;
}

interface Section {
  id: string;
  title: string;
  doc: string;
  content: Content[];
  subsections: Section[];
  icon?: React.ReactNode;
}

const NavSection: React.FC<{
  section: Section;
  currentSectionId: string | null;
  openSections: Record<string, boolean>;
  toggleSection: (sectionId: string) => void;
  onSelectSection: (sectionId: string) => void;
}> = ({ section, currentSectionId, openSections, toggleSection, onSelectSection }) => {
  const isOpen = openSections[section.id];
  const isCurrent = section.id === currentSectionId;

  return (
    <li key={section.id} className="mb-2">
      <div
        className={`flex items-center p-2 rounded-lg cursor-pointer ${
          isCurrent ? "bg-accent text-white" : "hover:bg-neutral"
        }`}
        onClick={() => {
          onSelectSection(section.id);
          if (section.subsections.length > 0) {
            toggleSection(section.id);
          }
        }}
      >
        <a href={`#${section.id}`} className="flex items-center flex-grow">
          {section.icon && <span className="mr-2">{section.icon}</span>}
          {section.title}
        </a>
        {section.subsections.length > 0 && (
          <div className={`ml-auto pl-2 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
            <ChevronRight size={16} />
          </div>
        )}
      </div>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-screen" : "max-h-0"}`}>
        {section.subsections.length > 0 && (
          <ul className="ml-4 mt-2">
            {section.subsections.map((subsection) => (
              <NavSection
                key={subsection.id}
                section={subsection}
                currentSectionId={currentSectionId}
                openSections={openSections}
                toggleSection={toggleSection}
                onSelectSection={onSelectSection}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
};

const App: React.FC = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);

  const findSectionPath = (sections: Section[], id: string, path: Section[] = []): Section[] | null => {
    for (const section of sections) {
      const newPath = [...path, section];
      if (section.id === id) {
        return newPath;
      }
      const subPath = findSectionPath(section.subsections, id, newPath);
      if (subPath) {
        return subPath;
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchDocs = async () => {
      const response = await fetch("./manifest.json");
      const manifest = await response.json();

      const buildSections = async (
        /* eslint-disable */
        currentManifest: any,
        path: string
      ): Promise<Section[]> => {
        const sections: Section[] = [];

        for (const key in currentManifest) {
          if (key === "files") continue;

          const newPath = `${path}/${key}`;
          const manifestItem = currentManifest[key];
          const docPath = `./doc-sources${newPath}/doc.md`;
          let doc = "";
          try {
            const response = await fetch(docPath);
            if (response.ok) {
              doc = await response.text();
            }
          } catch (e) {
            // no doc.md file
            console.warn("No doc.md file found", e);
          }

          const contentPath = `./doc-sources${newPath}/content.json`;
          let content: Content[] = [];
          try {
            const response = await fetch(contentPath);
            if (response.ok) {
              const contentJson = await response.json();
              content = await Promise.all(
                contentJson.map(async (item: any) => {
                  const itemPath = `./doc-sources${newPath}/${item.filename}`;
                  let itemContent;

                  if (item.type === "code") {
                    try {
                      const codeResponse = await fetch(itemPath);
                      if (codeResponse.ok) {
                        itemContent = await codeResponse.text();
                      } else {
                        itemContent = `// Code file not found: ${item.filename}`;
                      }
                    } catch (e) {
                      console.log("Error fetching code file:", e);
                      itemContent = `// Error fetching code file: ${item.filename}`;
                    }
                  } else if (item.type === "image") {
                    itemContent = itemPath; // Just use the path for the src attribute
                  }
                  return { ...item, content: itemContent };
                })
              );
            }
          } catch (e) {
            console.warn("No content.json file found", e);
          }

          const section: Section = {
            id: newPath.substring(1).replace(/\//g, "-"),
            title: key,
            doc,
            content,
            subsections: await buildSections(manifestItem, newPath),
          };
          sections.push(section);
        }
        return sections;
      };

      const newSections = await buildSections(manifest, "");

      const sortSections = async (sections: Section[], path: string) => {
        try {
          const response = await fetch(`./doc-sources${path}/order.json`);
          if (response.ok) {
            const order = await response.json();
            sections.sort((a, b) => {
              const aIndex = order.indexOf(a.id.split("-").pop()!);
              const bIndex = order.indexOf(b.id.split("-").pop()!);

              if (aIndex === -1 && bIndex === -1) {
                return a.title.localeCompare(b.title);
              }
              if (aIndex === -1) {
                return 1;
              }
              if (bIndex === -1) {
                return -1;
              }
              return aIndex - bIndex;
            });
          } else {
            sections.sort((a, b) => a.title.localeCompare(b.title));
          }
        } catch (e) {
          console.warn("No order file found", e);
          // no order file, sort alphabetically
          sections.sort((a, b) => a.title.localeCompare(b.title));
        }

        for (const section of sections) {
          if (section.subsections.length > 0) {
            await sortSections(section.subsections, `/${section.id.replace(/-/g, "/")}`);
          }
        }
      };

      await sortSections(newSections, "");

      setSections(newSections);

      const hash = decodeURIComponent(window.location.hash.substring(1));
      if (hash) {
        setCurrentSectionId(hash);
        const path = findSectionPath(newSections, hash);
        if (path) {
          const open: Record<string, boolean> = {};
          for (const section of path) {
            open[section.id] = true;
          }
          setOpenSections(open);
        }
      } else if (newSections.length > 0) {
        setCurrentSectionId(newSections[0].id);
      }
    };

    fetchDocs();
  }, []);

  const findSection = (sections: Section[], id: string | null): Section | null => {
    if (!id) return null;
    for (const section of sections) {
      if (section.id === id) {
        return section;
      }
      const found = findSection(section.subsections, id);
      if (found) {
        return found;
      }
    }
    return null;
  };

  const currentSection = findSection(sections, currentSectionId);

  useEffect(() => {
    if (currentSection) {
      if (decodeURIComponent(window.location.hash.substring(1)) !== currentSection.id) {
        window.location.hash = currentSection.id;
      }
    }
  }, [currentSection]);

  const getAllSections = (sections: Section[]): Section[] => {
    return sections.flatMap((s) => [s, ...getAllSections(s.subsections)]);
  };

  const allItems = getAllSections(sections);
  const currentItemIndex = allItems.findIndex((item) => item.id === currentSectionId);

  const handleNext = () => {
    if (currentItemIndex < allItems.length - 1) {
      const nextSection = allItems[currentItemIndex + 1];
      setCurrentSectionId(nextSection.id);
      const path = findSectionPath(sections, nextSection.id);
      if (path) {
        const open: Record<string, boolean> = {};
        for (const section of path) {
          open[section.id] = true;
        }
        setOpenSections(open);
      }
    }
  };

  const handlePrev = () => {
    if (currentItemIndex > 0) {
      const prevSection = allItems[currentItemIndex - 1];
      setCurrentSectionId(prevSection.id);
      const path = findSectionPath(sections, prevSection.id);
      if (path) {
        const open: Record<string, boolean> = {};
        for (const section of path) {
          open[section.id] = true;
        }
        setOpenSections(open);
      }
    }
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  if (sections.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen font-sans bg-base-100 text-secondary">
      <Header />
      <div className="p-10 h-[calc(100vh-80px)]">
        <div className="flex h-full bg-primary rounded-lg relative border border-border-color">
          {/* Left Panel: Navigation */}
          <div className="w-1/4 p-4 overflow-y-auto border-r border-border-color">
            <h2 className="text-lg font-bold mb-4">Airborne</h2>
            <nav>
              <ul>
                {sections.map((section) => (
                  <NavSection
                    key={section.id}
                    section={section}
                    currentSectionId={currentSectionId}
                    openSections={openSections}
                    toggleSection={toggleSection}
                    onSelectSection={setCurrentSectionId}
                  />
                ))}
              </ul>
            </nav>
          </div>

          {/* Center Panel: Explanation */}
          <div className="w-1/2 p-8 overflow-y-auto border-r border-border-color">
            {currentSection && (
              <div>
                <h2 className="text-2xl font-bold mb-4">{currentSection.title}</h2>
                <div className="prose prose-invert">
                  <ReactMarkdown>{currentSection.doc}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Code */}
          <div className="w-1/2 p-4 overflow-y-auto">
            {currentSection?.content?.map((item, index) => (
              <div key={index} className="mt-4">
                {item.type === "image" && <img src={item.content} alt={item.filename} className="w-full h-auto" />}
                {item.type === "code" && (
                  <div>
                    <h3 className="font-mono text-sm font-bold mb-2">{item.filename}</h3>
                    <SyntaxHighlighter language="typescript" style={vscDarkPlus}>
                      {item.content}
                    </SyntaxHighlighter>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="absolute bottom-10 right-10 flex space-x-4">
            <button
              onClick={handlePrev}
              disabled={currentItemIndex === 0}
              className="px-4 py-2 bg-accent text-white rounded-lg disabled:bg-neutral"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={currentItemIndex === allItems.length - 1}
              className="px-4 py-2 bg-accent text-white rounded-lg disabled:bg-neutral"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
