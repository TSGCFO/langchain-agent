import { Box, Container, styled } from '@mui/material';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

const MainContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  backgroundColor: theme.palette.background.default,
}));

const ContentArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

function Layout({ children }: LayoutProps) {
  return (
    <MainContainer maxWidth="lg">
      <ContentArea>
        {children}
      </ContentArea>
    </MainContainer>
  );
}

export default Layout;