import { useNavigate } from 'react-router';

import { Button } from '@renderer/components/base/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/base/card';
import { toolCategories } from '@renderer/pages/tools.config';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">工具箱</h1>
        <p className="text-muted-foreground">选择一个工具开始使用</p>
      </div>

      <div className="space-y-8">
        {toolCategories.map((category) => (
          <div key={category.category}>
            <h2 className="mb-4 text-xl font-semibold">{category.category}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {category.tools.map((tool) => (
                <Card key={tool.id} className="cursor-pointer transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <div className="mb-2 text-4xl">{tool.iconEmoji}</div>
                    <CardTitle>{tool.name}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => navigate(tool.path)} className="w-full">
                      打开工具
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
