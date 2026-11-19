import { describe, it, expect } from 'vitest';
import { breadcrumbTrail, breadcrumbLd, websiteLd } from '../src/pages/_seo';
import { TOOLS } from '../src/data/tools';

describe('breadcrumbTrail', () => {
  it('is empty for the home page', () => expect(breadcrumbTrail('/', 'x', TOOLS)).toEqual([]));
  it('puts a tool under All tools using the tool title', () => {
    const t = breadcrumbTrail('/rotate-image/', 'Whatever | SizeTune', TOOLS);
    expect(t.map((c) => c.name)).toEqual(['Home', 'All tools', TOOLS.find((x) => x.href === '/rotate-image/')!.title]);
    expect(t.at(-1)!.href).toBe('/rotate-image/');
  });
  it('puts a guide under Guides and strips the site suffix', () => {
    const t = breadcrumbTrail('/guides/a/', 'My Guide | SizeTune', TOOLS);
    expect(t.map((c) => c.name)).toEqual(['Home', 'Guides', 'My Guide']);
  });
  it('handles the hubs and policy pages', () => {
    expect(breadcrumbTrail('/tools/', 't', TOOLS).map((c) => c.name)).toEqual(['Home', 'All tools']);
    expect(breadcrumbTrail('/guides/', 't', TOOLS).map((c) => c.name)).toEqual(['Home', 'Guides']);
    expect(breadcrumbTrail('/privacy/', 'Privacy | SizeTune', TOOLS).map((c) => c.name)).toEqual(['Home', 'Privacy']);
  });
  it('emits absolute, 1-based BreadcrumbList items', () => {
    const ld = breadcrumbLd(breadcrumbTrail('/rotate-image/', 'x', TOOLS));
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement[0]).toMatchObject({ position: 1, item: 'https://sizetune.com/' });
    expect(ld.itemListElement[2].item).toBe('https://sizetune.com/rotate-image/');
  });
  it('WebSite entity carries no search action or rating', () => {
    expect(JSON.stringify(websiteLd)).not.toMatch(/SearchAction|aggregateRating|review/i);
  });
});
